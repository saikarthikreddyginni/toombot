/*

the goal of this preprocessor is to monitor how 'active' a chatroom is.

the temprature of the chatroom should be a function of:
	- number of parties participating
	- how quickly messages are being responded to

this preprocessor considers only the previous n minutes of history

*/

let rooms = {}; // key: message channel value: array of message timestamps

const max_history = 2 * 60 * 1000; // 2 minutes

const Process = message => {

	let prev = rooms[message.channel];
	if(prev == undefined) {
		rooms[message.channel] = [];
	}

	const curr = Date.now();

	rooms[message.channel] = [
		...rooms[message.channel],
		message,
	].filter(messages => curr - messages.ts < max_history);

	return new Promise((resolve, reject) =>
		resolve(Object.assign(
			{},
			message,
			{ temperature: rooms[message.channel].length }
		))
	);
}

module.exports = {
	Process
}