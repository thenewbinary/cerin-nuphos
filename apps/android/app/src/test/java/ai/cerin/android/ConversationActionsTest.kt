package ai.cerin.android

import ai.cerin.android.data.ConversationActions
import ai.cerin.android.data.JsonValue
import org.junit.Assert.*
import org.junit.Test
import ai.cerin.android.data.Http
import kotlinx.coroutines.runBlocking

class ConversationActionsTest {
    @Test fun shareEscapesSegmentsAndRejectsEmptyIdentity() {
        assertEquals("https://platform.cerin.ai/teams/a%2Fb/agent/s%20%3F%23", ConversationActions.shareUrl("a/b", "s ?#"))
        assertNull(ConversationActions.shareUrl("", "s"))
    }
    @Test fun titleRequiresTrimmedNonemptyBoundedValue() {
        assertEquals("Chat", ConversationActions.validTitle(" Chat "))
        assertNull(ConversationActions.validTitle(" "))
        assertNull(ConversationActions.validTitle("x".repeat(121)))
    }}
