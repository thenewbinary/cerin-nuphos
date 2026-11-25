#if os(iOS)
import SwiftUI
import UIKit

/// The Home Screen icon. Icon A (the original mark) is the primary AppIcon; every other
/// selectable icon is the alternate icon set `AppIcon-<id>`.
struct AppIconPicker: View {
    private static let characters = ["Pearl Earring", "Van Gogh", "The Scream", "Son of Man"]
    private static let layouts = ["Classic", "Bleed", "Peek"]
    static let icons: [(id: String, name: String)] = [("A", "Cerin")]
        + zip("CDEF", characters).flatMap { letter, character in
            layouts.enumerated().map { ("\(letter)\($0.offset + 1)", "\(character), \($0.element)") }
        }

    static var current: String {
        #if CERIN_SHARE_EXTENSION
        return "A"
        #else
        guard let alternate = UIApplication.shared.alternateIconName else { return "A" }
        if alternate.hasPrefix("AppIcon-B") { return "A" }
        return String(alternate.dropFirst("AppIcon-".count))
        #endif
    }

    private static func resetRemovedAlternateIconIfNeeded() {
        #if !CERIN_SHARE_EXTENSION
        guard UIApplication.shared.alternateIconName?.hasPrefix("AppIcon-B") == true else { return }
        UIApplication.shared.setAlternateIconName(nil) { _ in }
        #endif
    }

    @State private var selected = Self.current

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 64), spacing: 16)], spacing: 16) {
                ForEach(Self.icons, id: \.id) { icon in
                    Button {
                        selected = icon.id
                        #if !CERIN_SHARE_EXTENSION
                        UIApplication.shared.setAlternateIconName(icon.id == "A" ? nil : "AppIcon-\(icon.id)") { error in
                            if error != nil { selected = Self.current }
                        }
                        #endif
                    } label: {
                        Image("AppIconPreview-\(icon.id)")
                            .resizable()
                            .scaledToFit()
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .padding(3)
                            .overlay {
                                RoundedRectangle(cornerRadius: 17, style: .continuous)
                                    .stroke(selected == icon.id ? Color.accentColor : .clear, lineWidth: 2.5)
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(icon.name)
                    .accessibilityAddTraits(selected == icon.id ? .isSelected : [])
                }
            }
            .padding()
        }
        .background(Theme.canvas)
        .navigationTitle("App icon")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: Self.resetRemovedAlternateIconIfNeeded)
    }
}
#endif
