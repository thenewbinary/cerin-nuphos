// The gateway keeps the last published state, so a turn that settles without a
// later SDK state change (held-turn cancel, wedged force-cancel) must publish too.
const helper = `
function cerinSessionState(session) {
    if (session.queryClosed) return "interrupted";
    if ((session.activeTurn && !session.activeTurn.settled) || (session.turnQueue ?? []).some((turn) => !turn.settled))
        return "active";
    if (session.cerinSdkWedged) return "idle";
    return session.lastSessionState === undefined || session.lastSessionState === "idle" ? "idle" : "active";
}
async function publishCerinSessionState(agent, sessionId, session) {
    if (agent.sessions[sessionId] !== session) return;
    try {
        await agent.client.sessionUpdate({
            sessionId,
            update: { sessionUpdate: "session_info_update", _meta: {
                "ai.cerin/sessionState": { state: cerinSessionState(session) }
            }}
        });
    }
    catch (error) {
        agent.logger.error("Could not publish runtime session state", error);
    }
}
`

function replaceOnce(source, anchor, replacement, what) {
  if (source.split(anchor).length !== 2) throw new Error(`Expected one Claude ${what}.`)
  return source.replace(anchor, () => replacement)
}

export function patchClaudeSessionState(source) {
  const stateAnchor =
    '                                break;\n                            }\n                            case "memory_recall": {'
  source = replaceOnce(
    source,
    stateAnchor,
    `
                                await publishCerinSessionState(this, params.sessionId, session);
                                if (message.state === "idle") await session.titles.onTurnEnd(session);
${stateAnchor}`,
    'session-state lifecycle handoff',
  )
  source = replaceOnce(
    source,
    '                                    await session.titles.onTurnEnd(session);',
    '                                    // Runtime state is published before optional title enrichment.',
    'turn-end title handoff',
  )
  source = replaceOnce(
    source,
    '                                session.lastSessionState = message.state;',
    '                                session.lastSessionState = message.state;\n                                session.cerinSdkWedged = false;',
    'SDK session-state record',
  )
  source = replaceOnce(
    source,
    '                    settleActive(turnOutcome(session, "cancelled"));\n                    // The cancelled turn\'s result may never come',
    '                    session.cerinSdkWedged = true;\n                    settleActive(turnOutcome(session, "cancelled"));\n                    // The cancelled turn\'s result may never come',
    'force-cancel settle',
  )
  source = replaceOnce(
    source,
    '        await this.publishGoalFromPrompt(params.sessionId, firstText, promptUuid);\n        return response;',
    '        void turn.completion.then(() => publishCerinSessionState(this, params.sessionId, session));\n        await this.publishGoalFromPrompt(params.sessionId, firstText, promptUuid);\n        return response;',
    'prompt turn handoff',
  )
  const publishLoaded =
    '        await publishCerinSessionState(this, params.sessionId, this.sessions[params.sessionId]);'
  source = replaceOnce(
    source,
    '        await this.replaySessionHistory(params.sessionId);',
    `        await this.replaySessionHistory(params.sessionId);\n${publishLoaded}`,
    'session load',
  )
  source = replaceOnce(
    source,
    '        const result = await this.getOrCreateSession(params);\n        // Needs to happen after we return the session',
    `        const result = await this.getOrCreateSession(params);\n${publishLoaded}\n        // Needs to happen after we return the session`,
    'session resume',
  )
  // Claude Code also runs cycles of its own, such as a task notification, with
  // no Turn. The published state calls them active, so the snapshot offers a
  // steer; refusing it with noRunningTurn left the message waiting for the
  // cycle to end. Start it as a turn that pre-empts the cycle instead: with the
  // default priority the SDK folds it into the cycle, whose task-notification
  // result never settles a user turn.
  source = replaceOnce(
    source,
    '        if (!turnInFlight) {\n            const promptRequest = {',
    `        if (!turnInFlight && cerinSessionState(session) === "active") {
            this.prompt({ sessionId, prompt: params.prompt, cerinSteer: true }).catch((error) => {
                this.logger.error(\`Session \${sessionId}: steer into a runtime cycle failed: \${error}\`);
            });
            return { outcome: "injected" };
        }
        if (!turnInFlight) {
            const promptRequest = {`,
    'steer idle check',
  )
  source = replaceOnce(
    source,
    '        userMessage.uuid = promptUuid;\n',
    `        userMessage.uuid = promptUuid;
        if (params.cerinSteer)
            userMessage.priority =
                (session.pendingUserInputCount ?? 0) > 0 ? STEER_PRIORITY_LATER : STEER_PRIORITY_NOW;
`,
    'prompt input',
  )
  const closeAnchor = '        session.queryClosed = true;'
  source = replaceOnce(
    source,
    closeAnchor,
    `${closeAnchor}
        const stateSessionId = Object.entries(this.sessions).find(([, value]) => value === session)?.[0];
        if (stateSessionId) void publishCerinSessionState(this, stateSessionId, session);`,
    'native query teardown',
  )
  return `${helper}\n${source}`
}
