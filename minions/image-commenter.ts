import { SlackMessage, MinionModule, MinionResult } from '../types'
import * as axios from 'axios'
import * as imagize from './image-ize';
import * as linkMeta from './link-meta'

const reddit_session = axios.create({
	baseURL: 'http://reddit.com',
	headers: {
		'User-Agent': '/u/taimur38'
	},
	timeout: 20000
})

const key = 'imageCommenter'

function* onMessage(message : SlackMessage & imagize.Response & linkMeta.Response) : Iterator<Promise<MinionResult>> {

    if(message.imageTags == undefined || message.imageTags.length == 0)
        return Promise.resolve()

    if(message.link_meta[0].link.domain.indexOf('instagram') == -1) {

        console.log(message.link_meta[0].link.domain);
        return Promise.resolve()
    }

    console.log(JSON.stringify(message.imageTags[0].classes, undefined, 2))

    const topClasses = message.imageTags[0].classes
        .map(c => ({ ...c, super_score: c.type_hierarchy == undefined ? c.score : c.score + c.type_hierarchy.split('/').length/3 }))
        .filter(c => c.super_score > 0.8 && c.class.indexOf('color') == -1)
        .sort((a, b) => b.super_score - a.super_score)
        .slice(0, 2)

    const response : SlackMessage = yield Promise.resolve({
        send: true,
		threadReply: true,
        text: "is this picture about " + topClasses.map(c => c.class).join(' and ') + "?",
        contextMatch: (msg : SlackMessage) => msg.channel.id == message.channel.id,
        filter: (msg : SlackMessage) => msg.text.search(/\b(yeah|yup|yep|yes|sure|no|nope)\b/gi) > -1
    })

    if(response.text.search(/\b(no|nope)\b/gi) > -1) {
        return Promise.resolve({
            text: ":(",
            send: true
        })
    }

    /*const goFurther : SlackMessage = yield Promise.resolve({
        text: "would you like to see related content from reddit?",
        send: true,
        contextMatch: (msg : SlackMessage) => msg.channel.id == message.channel.id,
        filter: (msg : SlackMessage) => msg.text.search(/\b(yeah|yup|yep|yes|no|nope)\b/gi) > -1
    })

    if(goFurther.text.search(/\b(no|nope)\b/gi) > -1) {
        return Promise.resolve({
            text: "ok",
            send: true
        })
    }
	*/

	const query = '(' + topClasses.map(x => x.class).join(') OR (') + ')';
    //const query = topClasses.reduce((agg, curr) => agg + '(' + curr.class + ') OR ', '')

    return reddit_session.get(`/search.json?q=${query}+nsfw:no+self:no`)
        .then(rsp => {
            if(rsp.data)
                return (<any>rsp.data).data.children;
            throw new Error('no results')
        })
        .then(posts => {
            const post = posts[0].data;
            if(post.is_self)
                return {
                    send: true,
                    text: post.selftext + ': ' + post.url
                }
            else
                return {
                    send: true,
                    text: post.title + ': ' + post.url
                }
        })
        .catch(err => {
            console.error(err);
            return {
                send: true,
                text: "reddit search taking too long :("
            }
        })
}

const mod : MinionModule = {
    onMessage,
    key,
    requirements: ['imageTags', 'link_meta']
}

export default mod;
