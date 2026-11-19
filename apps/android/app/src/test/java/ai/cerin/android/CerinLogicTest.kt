package ai.cerin.android

import ai.cerin.android.data.CerinWeb
import ai.cerin.android.model.HistoryTime
import ai.cerin.android.model.PlanLink
import ai.cerin.android.ui.components.MarkdownStreamUpdate
import ai.cerin.android.ui.components.bareUrlEnd
import ai.cerin.android.ui.components.containsMarkdownTable
import ai.cerin.android.ui.components.markdownStreamUpdate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import okhttp3.ResponseBody.Companion.toResponseBody

class CerinLogicTest {
    @Test
    fun loginUrlOpensTheChosenProviderWithOnlyTheOpaqueHandle() {
        val handle = "h".repeat(43)
        val base = ai.cerin.android.data.CerinApi.BASE_URL
        assertEquals("$base/auth/social/google/start?handle=$handle", CerinWeb.loginUrl(handle, CerinWeb.Provider.Google))
        assertEquals("$base/auth/social/apple/start?handle=$handle", CerinWeb.loginUrl(handle, CerinWeb.Provider.Apple))
        try { CerinWeb.loginUrl("a+b&c", CerinWeb.Provider.Google); org.junit.Assert.fail() } catch (_: IllegalArgumentException) { }
    }

    @Test
    fun providerHeaderMatchesIosOrderAndFallback() {
        assertEquals(listOf(CerinWeb.Provider.Apple, CerinWeb.Provider.Google), CerinWeb.providers("google,apple"))
        assertEquals(listOf(CerinWeb.Provider.Google), CerinWeb.providers(" google,unknown,google "))
        assertEquals(emptyList<CerinWeb.Provider>(), CerinWeb.providers(""))
        assertEquals(listOf(CerinWeb.Provider.Google), CerinWeb.providers(null))
    }

    @Test
    fun providerDiscoveryTreats503AsNoneAndOtherFailuresAsRetryable() {
        fun client(code: Int, header: String?) = okhttp3.OkHttpClient.Builder().addInterceptor { chain ->
            val request = chain.request()
            assertEquals("GET", request.method)
            assertEquals("/auth/social/login", request.url.encodedPath)
            assertNull(request.header("Authorization"))
            okhttp3.Response.Builder().request(request).protocol(okhttp3.Protocol.HTTP_1_1).code(code).message("fixture")
                .apply { if (header != null) header("X-Cerin-Social-Providers", header) }
                .body("".toResponseBody()).build()
        }.build()
        assertEquals(listOf(CerinWeb.Provider.Apple, CerinWeb.Provider.Google), CerinWeb.availableProviders(client(200, "google,apple")))
        assertEquals(listOf(CerinWeb.Provider.Google), CerinWeb.availableProviders(client(200, null)))
        assertEquals(emptyList<CerinWeb.Provider>(), CerinWeb.availableProviders(client(503, "google")))
        for (code in listOf(500, 404, 401)) {
            try { CerinWeb.availableProviders(client(code, "google")); org.junit.Assert.fail() } catch (_: java.io.IOException) { }
        }
    }

    @Test
    fun externalAccountTokenCannotBecomeLoginDelivery() {
        assertNull(CerinWeb.parseDelivery("cerin://google-callback?token=abc123", "pending"))
        assertNull(CerinWeb.parseDelivery("/callback?state=pending&token=abc123", "pending"))
    }

    @Test
    fun deliveryAcceptsBoundCodeAndProviderFailure() {
        val code = "c".repeat(43)
        assertEquals(CerinWeb.CallbackResult.Code(code), CerinWeb.parseDelivery("/callback?state=pending&code=$code", "pending"))
        assertTrue(CerinWeb.parseDelivery("/callback?state=pending&error=denied", "pending") is CerinWeb.CallbackResult.Failure)
    }

    @Test
    fun deliveryRejectsAmbiguousAndMalformedCallbacks() {
        val code = "c".repeat(43)
        for (target in listOf(
            "/callback?state=other&code=$code", "/callback?code=$code",
            "/callback?state=pending&state=pending&code=$code",
            "/callback?state=pending&code=$code&code=$code",
            "/callback?state=pending&code=$code&error=denied",
            "/callback?state=pending&code=%ZZ", "/callback/extra?state=pending&code=$code",
            "//evil/callback?state=pending&code=$code", "/callback?state=pending&code=$code#fragment",
            "/callback?state=pending&%73tate=pending&code=$code",
            "/%63allback?state=pending&code=$code",
        )) assertNull(target, CerinWeb.parseDelivery(target, "pending"))
    }

    @Test
    fun historyTimeNow() {
        val now = Instant.parse("2026-08-26T12:00:00Z")
        assertEquals("now", HistoryTime.format(now, now))
    }

    @Test
    fun historyTimeMinutes() {
        val now = Instant.parse("2026-08-26T12:00:00Z")
        val then = now.minusSeconds(5 * 60)
        assertEquals("5 min", HistoryTime.format(then, now))
    }

    @Test
    fun planLinkParsesTeamAndPlan() {
        val target = PlanLink.target("https://platform.cerin.ai/teams/teamA/plans/planB")
        assertEquals("teamA", target?.teamId)
        assertEquals("planB", target?.planId)
    }

    @Test
    fun markdownStreamAppendsOnlyTheDelta() {
        assertEquals(MarkdownStreamUpdate.None, markdownStreamUpdate("Hello", "Hello"))
        assertEquals(MarkdownStreamUpdate.Append(" world"), markdownStreamUpdate("Hello", "Hello world"))
        assertEquals(MarkdownStreamUpdate.Restart, markdownStreamUpdate("Hello world", "Hi"))
    }

    @Test
    fun bareUrlEndsBeforeFullWidthPunctuation() {
        val pr = "https://github.com/thenewbinary/cerin-platform/pull/2595"
        for (tail in listOf("（Fixes", "，下一句", "。", "、b", "：", "「x」", "\u3000next")) {
            assertEquals(tail, pr.length, bareUrlEnd(pr + tail))
        }
        for (url in listOf(pr, "https://zh.wikipedia.org/wiki/台灣", "https://example.com/a?b=c,d")) {
            assertEquals(url, url.length, bareUrlEnd(url))
        }
    }

    @Test
    fun markdownTablesAreFoundByTheirDelimiterRow() {
        for (table in listOf(
            "| A | B |\n| --- | --- |\n| 1 | 2 |",
            "Status:\n\nService | State\n:--- | ---:\nBackend | Healthy",
            "| Only |\n|:-:|",
        )) assertTrue(table, containsMarkdownTable(table))
        for (text in listOf(
            "Plain words",
            "A | pipe in a sentence",
            "Above\n---\nA setext heading",
            "- a list\n- --- item",
            "| A | B |\nno delimiter",
        )) assertFalse(text, containsMarkdownTable(text))
    }
}
