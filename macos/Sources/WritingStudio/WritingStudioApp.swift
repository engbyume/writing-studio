import SwiftUI

@main
@MainActor
struct WritingStudioApp: App {
    @StateObject private var workspace: Workspace
    @StateObject private var suggestions: Suggestions
    @State private var showingSuggestionSettings = false

    init() {
        let workspace = Workspace()
        _workspace = StateObject(wrappedValue: workspace)
        _suggestions = StateObject(wrappedValue: Suggestions(workspace: workspace))
    }

    var body: some Scene {
        Window("Writing Studio", id: "workspace") {
            VStack(spacing: 0) {
                if let errorMessage = workspace.errorMessage {
                    Text(errorMessage)
                        .padding()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    WorkspaceView(webView: workspace.webView)
                }

                Divider()
                HStack {
                    Text(suggestions.status)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button(suggestions.isEnabled ? "Pause Suggestions" : "Enable in TextEdit") {
                        if suggestions.isEnabled { suggestions.stop() }
                        else { showingSuggestionSettings = true }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
            }
            .frame(minWidth: 760, minHeight: 580)
            .onAppear { workspace.start() }
            .sheet(isPresented: $showingSuggestionSettings) {
                Form {
                    Section("TextEdit integration") {
                        Text("While TextEdit is active, Writing Studio reads up to 512 characters before the caret and looks for a continuation in your imported sources. Click Insert to add the suggestion. Other apps are not monitored in this build.")
                        Toggle("Allow TextEdit", isOn: $suggestions.allowsTextEdit)
                        Toggle("Enable TextEdit suggestions", isOn: Binding(
                            get: { suggestions.isEnabled },
                            set: { enabled in enabled ? suggestions.start() : suggestions.stop() }
                        ))
                        .disabled(!suggestions.allowsTextEdit)
                        Text(suggestions.status)
                            .foregroundStyle(.secondary)
                    }
                    Button("Done") { showingSuggestionSettings = false }
                        .keyboardShortcut(.defaultAction)
                }
                .formStyle(.grouped)
                .frame(width: 490, height: 290)
            }
        }
        .defaultSize(width: 1100, height: 780)
    }
}
