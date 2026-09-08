/** Append one undoable batch without mutating cached flags or first deleting history. */
export async function appendHistory(scene, historyKey, events) {
	const history = foundry.utils.deepClone(scene.getFlag("simplefog", historyKey) ?? { events: [], pointer: 0 });
	history.events = history.events.slice(0, history.pointer);
	history.events.push(foundry.utils.deepClone(events));
	history.pointer = history.events.length;
	// V14 replaces arrays on update. One write also leaves previous history intact if saving fails.
	const updated = await scene.setFlag("simplefog", historyKey, history);
	if (!updated) throw new Error("Simple Fog history update was cancelled.");
	return history;
}
