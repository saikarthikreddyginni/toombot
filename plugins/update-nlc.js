const neo4j = require('neo4j-driver').v1;
const driver = neo4j.driver(`bolt://${process.env.NEO_URL}`, neo4j.auth.basic(process.env.NEO_USER, process.env.NEO_PASS))

const nlc = require('../lib/nlc')

function* onMessage(message) {

	const session = driver.session();

	return session.run(`
		MATCH (u:User {name: "toombot"})-->(m:Message)<-[r:REACTED]-(target:User)
		return m.text as comment, r.type as reaction, count(distinct(r)) as counts
	`)
	.then(res => res.records.map(r => ({
			comment: r.get('comment'),
			reaction: r.get('reaction'),
			count: r.get('counts').toInt()
	})))
	.then(reactions => reactions.filter(r => r.reaction.match(/\+1|-1/g) !== undefined))
	.then(reactions => {

		const cmap = new Map();

		reactions.forEach(({ comment, reaction, count}) => {
			const modifier = reaction.match(/-1/g) == undefined ? 1 : -1;
			cmap.set(comment, (cmap.get(comment) || 0) + modifier * count);
		})

		let formatted = []; // { classes: ['good', 'bad'], text: ''}
		cmap.forEach((count, comment) => {
			console.log(comment, count)
			if(count == 0)
				return

			const cls = count > 0 ? 'good' : 'bad';
			formatted.push({ classes: [cls], text: comment })
		})

		return formatted;
	})
	.then(training_data => nlc.createClassifier('toombot-output', training_data))
	.then(resp => {
		session.close();	
		return { text: `training new classifier` }
	})
	.catch(err => {
		console.log('error in update nlc', err);
		session.close();
	})

}

module.exports = {
	onMessage,
	key: msg => 'update-nlc',
	filter: msg => {
		const match = msg.text.match(/update|training/gi)
		return msg.user.name == 'taimur' && match && match.length == 2
	}
}
