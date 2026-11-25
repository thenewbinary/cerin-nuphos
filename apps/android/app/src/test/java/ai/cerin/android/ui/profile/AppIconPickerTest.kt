package ai.cerin.android.ui.profile

import org.junit.Assert.assertEquals
import org.junit.Test

class AppIconPickerTest {
    @Test
    fun noEnabledAliasFallsBackToCerin() {
        assertEquals("A", launcherIconForEnabledAliases(emptyList()))
    }

    @Test
    fun removedAliasCannotBecomeTheSelection() {
        assertEquals("A", launcherIconForEnabledAliases(listOf("B2")))
    }

    @Test
    fun remainingSelectionIsPreserved() {
        assertEquals("C2", launcherIconForEnabledAliases(listOf("C2")))
    }

    @Test
    fun duplicateEntriesResolveToOneDeterministicSelection() {
        assertEquals("C2", launcherIconForEnabledAliases(listOf("F3", "C2")))
    }
}
