import SwiftUI

@main
struct SverigeApp: App {
    var body: some Scene {
        WindowGroup {
            PlannerScreen()
        }
    }
}

struct PlannerScreen: View {
    @State private var showInformation = false
    @StateObject private var webState = NativeWebState()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            PlannerWebView(state: webState)
                .overlay {
                    if let message = webState.loadError {
                        VStack(spacing: 16) {
                            Text("Planen kunde inte visas").font(.headline)
                            Text(message).multilineTextAlignment(.center)
                            Button("Försök igen") { webState.reload() }
                                .buttonStyle(.borderedProminent)
                        }
                        .padding(24)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(.background)
                    }
                }
                .navigationTitle("Sverigevistelseplaneraren")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button {
                            showInformation = true
                        } label: {
                            Label("Om appen och integritet", systemImage: "info.circle")
                        }
                    }
                }
        }
        .sheet(isPresented: $showInformation) {
            AppInformationScreen()
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active { webState.refreshDate() }
        }
    }
}

private struct AppInformationScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Din plan") {
                    Text("Planera och dokumentera registrerade Sverigedagar mot en dagbudget som du själv väljer.")
                    Text("Verktyget avgör inte skattehemvist, skattskyldighet eller juridisk säkerhet.")
                }
                Section("Lokal lagring") {
                    Text("Appens filer följer med installationen. Din plan sparas lokalt på den här enheten. Konto och molnsynk ingår inte.")
                    Text("Rensa planen med Rensa all data i appen. En avinstallation kan också ta bort din lokala plan. Spara en backup först om du vill behålla den.")
                }
                Section("Backup och export") {
                    Text("JSON-backup innehåller profilsvar och vistelser i läsbar text. CSV innehåller bara vistelser. Välj själv var filerna ska sparas.")
                    Text("En återställning ändrar inte planen förrän du har kontrollerat och bekräftat den i appen.")
                    Text("Platser du väljer i Filer, till exempel iCloud Drive, kan hanteras av andra tjänster. Appen skickar inte din plan till en egen server.")
                }
                Section("Officiella källor") {
                    Text("Källornas länkar och granskningsdatum visas vid observationerna. När du öppnar en extern källa används din vanliga webbläsare och internetanslutning.")
                }
            }
            .navigationTitle("Om och integritet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Stäng") { dismiss() }
                }
            }
        }
    }
}
