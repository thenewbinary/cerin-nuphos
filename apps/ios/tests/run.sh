#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
swiftc BotAvatars/BotAvatars.swift cerin-ios/Services/BotFaces.swift tests/BotAvatarTests.swift cerin-ios/Services/Chat/ThreadReference.swift cerin-ios/Services/ImageAttachment.swift tests/ImageAttachmentTests.swift cerin-ios/Services/PastedFile.swift tests/PastedFileTests.swift cerin-ios/Services/Chat/JSONValue.swift cerin-ios/Services/Chat/RuntimeObservation.swift cerin-ios/Services/Chat/ConversationUnread.swift cerin-ios/Services/Chat/ChatModels.swift cerin-ios/Services/CerinAPIBase.swift cerin-ios/Services/Chat/RuntimeTranscript.swift cerin-ios/Services/Chat/UIStreamReducer.swift cerin-ios/Services/Chat/ToolRuns.swift cerin-ios/Services/Chat/ReasoningText.swift Shared/SessionLink.swift cerin-ios/Services/Chat/AppLink.swift cerin-ios/Views/Chat/PlanLink.swift tests/AppLinkTests.swift cerin-ios/Services/Chat/StreamBacklog.swift cerin-ios/Services/Chat/SSEClient.swift cerin-ios/Services/Chat/StreamingMarkdown.swift cerin-ios/Services/Chat/MessagePreview.swift cerin-ios/Views/Chat/ChatRow.swift cerin-ios/Models/Channel.swift cerin-ios/Views/Home/ChatTime.swift tests/ChannelPostTests.swift cerin-ios/Services/Chat/TransferDownloads.swift cerin-ios/Services/Chat/TransferFiles.swift tests/TransferFilesTests.swift cerin-ios/Views/Home/ComposerAction.swift cerin-ios/Views/Home/ComposerReturn.swift tests/ComposerReturnTests.swift cerin-ios/Views/Home/SessionMention.swift cerin-ios/Models/AgentConversation.swift cerin-ios/Services/ConversationNesting.swift cerin-ios/Services/Chat/BotQuestions.swift cerin-ios/Services/Chat/AnsweredQuestion.swift tests/BotQuestionsTests.swift cerin-ios/Models/CredentialCatalog.swift cerin-ios/Models/AgentRuntime.swift cerin-ios/Models/SelectorBox.swift cerin-ios/Models/NewRuntime.swift tests/NewRuntimeTests.swift cerin-ios/Models/CerinUser.swift cerin-ios/Models/Team.swift cerin-ios/Services/LaunchCache.swift tests/LaunchCacheTests.swift cerin-ios/Services/Chat/ComposerDrafts.swift tests/ChatRowTests.swift tests/ComposerDraftsTests.swift tests/CredentialScopeTests.swift tests/ComposerActionTests.swift tests/SessionLinkTests.swift tests/SessionMentionTests.swift tests/SidebarFavoritesTests.swift tests/ConversationNestingTests.swift tests/TaskFollowsBotTests.swift tests/ResourceStripTests.swift tests/StreamBacklogTests.swift tests/SSEClientTests.swift tests/StreamingMarkdownTests.swift tests/MessagePreviewTests.swift cerin-ios/Services/Chat/MarkdownImages.swift tests/MarkdownImagesTests.swift cerin-ios/Services/Chat/BareURL.swift tests/BareURLTests.swift tests/LocalAgentTests.swift cerin-ios/Services/SignInSessions.swift tests/SignInSessionsTests.swift Shared/TurnActivityAttributes.swift tests/LiveActivityCardTests.swift tests/RuntimeObservationTests.swift cerin-ios/Services/Chat/ResumeFallback.swift tests/ResumeFallbackTests.swift cerin-ios/Services/Chat/DockDestination.swift tests/DockDestinationTests.swift -o "$test_dir/runtime-tests"
desktop=cerin-ios/Services/Desktop
swiftc "$desktop/ZlibStream.swift" "$desktop/RFBFramebuffer.swift" "$desktop/RFBClient.swift" "$desktop/RFBKeysym.swift" "$desktop/H264Stream.swift" tests/DesktopTests.swift -o "$test_dir/desktop-tests"
"$test_dir/desktop-tests"
"$test_dir/runtime-tests"
bash tests/analytics.sh
bash tests/social-login.sh
bash tests/auth-session.sh

swiftc cerin-ios/Services/Chat/JSONValue.swift ShareSupport/SharedShareSession.swift tests/ShareSessionLeaseTests.swift -o "$test_dir/share-lease-tests"
"$test_dir/share-lease-tests"
swiftc -D DEBUG -parse-as-library cerin-ios/Services/CerinAPIBase.swift cerin-ios/Services/PreviewIsolation.swift cerin-ios/Services/PreviewTransport.swift cerin-ios/Services/Chat/SSEClient.swift tests/PreviewIsolationTests.swift -o "$test_dir/preview-isolation-tests"
"$test_dir/preview-isolation-tests"
swiftc CerinShare/ShareFollowState.swift tests/ShareFollowStateTests.swift -o "$test_dir/share-follow-tests"
"$test_dir/share-follow-tests"
swiftc cerin-ios/Views/Home/HomeColumns.swift tests/HomeColumnsTests.swift -o "$test_dir/home-columns-tests"
"$test_dir/home-columns-tests"
swiftc cerin-ios/Views/Home/NewBox.swift tests/NewBoxTests.swift -o "$test_dir/new-box-tests"
"$test_dir/new-box-tests"
swiftc tests/StringCatalogTests.swift -o "$test_dir/string-catalog-tests"
"$test_dir/string-catalog-tests" Shared/Localizable.xcstrings
"$test_dir/string-catalog-tests" cerin-ios/InfoPlist.xcstrings
# A chat's real read builds against UIKit: as Mac Catalyst, it runs here without a simulator.
macos_sdk=$(xcrun --sdk macosx --show-sdk-path)
chat_sources=(
  BotAvatars/BotAvatars.swift \
  cerin-ios/Services/Chat/ThreadReference.swift \
  cerin-ios/Services/ImageAttachment.swift \
  cerin-ios/Services/PastedFile.swift \
  cerin-ios/Services/Chat/JSONValue.swift \
  cerin-ios/Services/Chat/RuntimeObservation.swift \
  cerin-ios/Services/Chat/ConversationUnread.swift \
  cerin-ios/Services/Chat/ChatModels.swift \
  cerin-ios/Services/CerinAPIBase.swift \
  cerin-ios/Services/Chat/ToolRuns.swift \
  Shared/SessionLink.swift \
  cerin-ios/Models/Channel.swift \
  cerin-ios/Views/Home/ChatTime.swift \
  cerin-ios/Services/Chat/TransferDownloads.swift \
  cerin-ios/Services/Chat/MarkdownImages.swift \
  cerin-ios/Models/AgentConversation.swift \
  cerin-ios/Services/ConversationNesting.swift \
  cerin-ios/Services/Chat/BotQuestions.swift \
  cerin-ios/Models/CredentialCatalog.swift \
  cerin-ios/Models/AgentRuntime.swift \
  cerin-ios/Models/CerinUser.swift \
  cerin-ios/Models/Team.swift \
  cerin-ios/Services/SignInSessions.swift \
  cerin-ios/Services/CerinAPI.swift \
  cerin-ios/Services/WorkspaceAPI.swift \
  cerin-ios/Services/Chat/OpenQuestions.swift \
  cerin-ios/Services/BotFaces.swift \
  cerin-ios/Services/Chat/AgentChatAPI.swift \
  cerin-ios/Services/LaunchCache.swift \
  cerin-ios/Views/Home/ComposerAttachment.swift \
  cerin-ios/Services/AccountAPI.swift \
  cerin-ios/Models/TeamMember.swift \
  cerin-ios/Services/StepUp.swift \
  cerin-ios/Views/Home/LucideIcon.swift \
  cerin-ios/Views/Theme.swift \
  cerin-ios/Services/Passkeys.swift \
  cerin-ios/Services/Chat/SSEClient.swift \
  cerin-ios/Services/Chat/ChannelSession.swift)
for chat_test in CancelledLoadTests ChannelPushTests HeldFilesTests QueueHoldTests UploadProgressTests; do
  swiftc -target arm64-apple-ios18.0-macabi -sdk "$macos_sdk" -Fsystem "$macos_sdk/System/iOSSupport/System/Library/Frameworks" \
    -I "$macos_sdk/System/iOSSupport/usr/lib/swift" -L "$macos_sdk/System/iOSSupport/usr/lib/swift" -parse-as-library -default-isolation MainActor \
    "${chat_sources[@]}" "tests/$chat_test.swift" -o "$test_dir/$chat_test"
  "$test_dir/$chat_test"
done

swiftc BotAvatars/BotAvatars.swift tests/HostedBotAvatarTests.swift -o "$test_dir/hosted-bot-avatar-tests"
"$test_dir/hosted-bot-avatar-tests"

# The store and the session it keeps (#3525), the runtimes it reloads, and a chat moved between them (#4214), with what they name. Analytics and AuthSession are stand-ins in the tests.
for store_test in ChatReopenTests RuntimeReloadTests RuntimeMoveTests; do
swiftc -target arm64-apple-ios18.0-macabi -sdk "$macos_sdk" -Fsystem "$macos_sdk/System/iOSSupport/System/Library/Frameworks" \
  -I "$macos_sdk/System/iOSSupport/usr/lib/swift" -L "$macos_sdk/System/iOSSupport/usr/lib/swift" -parse-as-library -default-isolation MainActor \
  "${chat_sources[@]}" \
  cerin-ios/Services/AgentStore.swift \
  cerin-ios/Services/Chat/ChatSession.swift \
  cerin-ios/Services/Chat/UIStreamReducer.swift \
  cerin-ios/Services/Chat/RuntimeTranscript.swift \
  cerin-ios/Services/Chat/ResumeFallback.swift \
  cerin-ios/Services/Chat/StreamBacklog.swift \
  cerin-ios/Services/Chat/DockDestination.swift \
  cerin-ios/Services/Chat/BrowserTabs.swift \
  cerin-ios/Services/Chat/AnsweredQuestion.swift \
  cerin-ios/Services/Desktop/*.swift \
  cerin-ios/Services/Terminal/TerminalSession.swift \
  cerin-ios/Models/SelectorBox.swift \
  cerin-ios/Views/Chat/ChatRow.swift \
  cerin-ios/Views/Chat/ShareSessionSheet.swift \
  cerin-ios/Views/Components/AvatarView.swift \
  cerin-ios/Views/Home/HomePage.swift \
  cerin-ios/Views/Home/NewBox.swift \
  ShareSupport/SubmissionAdmission.swift \
  ShareSupport/SharedShareSession.swift \
  "tests/$store_test.swift" -o "$test_dir/$store_test"
"$test_dir/$store_test"
done
