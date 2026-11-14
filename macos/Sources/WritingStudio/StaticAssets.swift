import Foundation
import Network

/// Vite emits root-relative ES modules and module workers. Serve only the bundled build.
final class StaticAssets {
    private static let maximumHeaderBytes = 8192
    private static let maximumConnections = 16

    private let listener: NWListener
    private let queue = DispatchQueue(label: "WritingStudio.static-assets")
    private let routes: [String: URL]
    private var connections: [ObjectIdentifier: NWConnection] = [:]

    init(root: URL) throws {
        let index = root.appendingPathComponent("index.html")
        let keys: Set<URLResourceKey> = [.isRegularFileKey, .isSymbolicLinkKey]
        guard try Self.isRegularFile(index, keys: keys) else { throw AssetError.missingIndex }
        var routes = ["/": index, "/index.html": index]
        let assets = root.appendingPathComponent("assets", isDirectory: true)
        let directory = try assets.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard directory.isDirectory == true, directory.isSymbolicLink != true else {
            throw AssetError.missingAssetDirectory
        }
        let files = try FileManager.default.contentsOfDirectory(
            at: assets, includingPropertiesForKeys: Array(keys), options: [.skipsHiddenFiles]
        )
        for file in files where Self.mimeType(file) != nil {
            guard try Self.isRegularFile(file, keys: keys),
                  file.lastPathComponent.utf8.allSatisfy(Self.isRouteByte) else { continue }
            routes["/assets/" + file.lastPathComponent] = file
        }
        self.routes = routes
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
        listener = try NWListener(using: parameters)
    }

    deinit {
        listener.cancel()
    }

    func start(onReady: @escaping (URL?) -> Void) {
        listener.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                guard let port = self?.listener.port?.rawValue else { return onReady(nil) }
                onReady(URL(string: "http://127.0.0.1:\(port)/"))
            case .failed:
                onReady(nil)
            default:
                break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self else { return connection.cancel() }
            accept(connection)
        }
        listener.start(queue: queue)
    }

    private func accept(_ connection: NWConnection) {
        guard connections.count < Self.maximumConnections else { return connection.cancel() }
        let id = ObjectIdentifier(connection)
        connections[id] = connection
        connection.stateUpdateHandler = { [weak self, weak connection] state in
            switch state {
            case .failed, .cancelled:
                self?.connections.removeValue(forKey: id)
                connection?.cancel()
            default:
                break
            }
        }
        connection.start(queue: queue)
        queue.asyncAfter(deadline: .now() + 5) { [weak connection] in connection?.cancel() }
        receiveHeader(connection, buffered: Data())
    }

    private func receiveHeader(_ connection: NWConnection, buffered: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: Self.maximumHeaderBytes) {
            [weak self, weak connection] data, _, complete, error in
            guard let connection else { return }
            guard let self, let data, error == nil else {
                connection.cancel()
                return
            }
            let request = buffered + data
            guard request.count <= Self.maximumHeaderBytes else { return connection.cancel() }
            if let end = request.range(of: Data([13, 10, 13, 10])) {
                guard end.upperBound == request.endIndex else { return connection.cancel() }
                respond(to: connection, request: request[..<end.lowerBound])
            } else if complete || request.count == Self.maximumHeaderBytes {
                connection.cancel()
            } else {
                receiveHeader(connection, buffered: request)
            }
        }
    }

    private func respond(to connection: NWConnection, request: Data) {
        guard let header = String(data: request, encoding: .ascii),
              let port = listener.port?.rawValue else { return connection.cancel() }
        let lines = header.components(separatedBy: "\r\n")
        let fields = lines[0].split(separator: " ", omittingEmptySubsequences: false)
        let host = "127.0.0.1:\(port)"
        guard fields.count == 3, fields[0] == "GET", fields[2] == "HTTP/1.1",
              permits(Array(lines.dropFirst()), host: host) else {
            send(connection, status: "400 Bad Request")
            return
        }
        guard let asset = routes[String(fields[1])], let type = Self.mimeType(asset),
              let data = try? Data(contentsOf: asset, options: .mappedIfSafe) else {
            send(connection, status: "404 Not Found")
            return
        }
        send(connection, status: "200 OK", type: type, data: data)
    }

    private func permits(_ lines: [String], host: String) -> Bool {
        var seenHost = false
        for line in lines {
            let parts = line.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
            guard parts.count == 2 else { return false }
            let value = parts[1].trimmingCharacters(in: .whitespaces)
            switch parts[0].lowercased() {
            case "host":
                guard !seenHost, value == host else { return false }
                seenHost = true
            case "origin":
                guard value == "http://" + host else { return false }
            case "sec-fetch-site":
                guard value == "none" || value == "same-origin" else { return false }
            case "content-length":
                guard value == "0" else { return false }
            case "transfer-encoding":
                return false
            default:
                break
            }
        }
        return seenHost
    }

    private func send(
        _ connection: NWConnection, status: String,
        type: String = "text/plain; charset=utf-8", data: Data = Data()
    ) {
        let headers = [
            "HTTP/1.1 " + status,
            "Content-Type: " + type,
            "Content-Length: \(data.count)",
            "Connection: close",
            "Cache-Control: no-store",
            "X-Content-Type-Options: nosniff",
            "Cross-Origin-Resource-Policy: same-origin",
            "Referrer-Policy: no-referrer",
            "Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; "
                + "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; "
                + "worker-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        ].joined(separator: "\r\n") + "\r\n\r\n"
        connection.send(content: Data(headers.utf8) + data, completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    private static func isRegularFile(_ file: URL, keys: Set<URLResourceKey>) throws -> Bool {
        let values = try file.resourceValues(forKeys: keys)
        return values.isRegularFile == true && values.isSymbolicLink != true
    }

    private static func isRouteByte(_ byte: UInt8) -> Bool {
        switch byte {
        case 45, 46, 48...57, 65...90, 95, 97...122: true
        default: false
        }
    }

    private static func mimeType(_ url: URL) -> String? {
        switch url.pathExtension.lowercased() {
        case "html": "text/html; charset=utf-8"
        case "js", "mjs": "text/javascript; charset=utf-8"
        case "css": "text/css; charset=utf-8"
        case "svg": "image/svg+xml"
        case "png": "image/png"
        case "jpg", "jpeg": "image/jpeg"
        case "webp": "image/webp"
        case "woff2": "font/woff2"
        case "wasm": "application/wasm"
        default: nil
        }
    }

    private enum AssetError: Error { case missingIndex, missingAssetDirectory }
}
