/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const pkg = require('../package.json');
const nodeFetch = require("node-fetch");
const convert = require('xml-js');
let url = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url

let config = `${url}/launcher/config-launcher/config.json`;
let news = `${url}/launcher/news-launcher/news.json`;

class Config {
    GetConfig() {
        return new Promise((resolve, reject) => {
            nodeFetch(config).then(async config => {
                if (config.status === 200) return resolve(config.json());
                else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
            }).catch(error => {
                return reject({ error });
            })
        })
    }

    async getInstanceList() {
        let urlInstance = `${url}/files`
        let instances = await nodeFetch(urlInstance).then(res => res.json()).catch(err => err)
        let instancesList = []
        instances = Object.entries(instances)

        for (let [name, data] of instances) {
            let instance = data
            instance.name = name
            instancesList.push(instance)
        }
        return instancesList
    }

    async getNews() {
        let config = await this.GetConfig() || {}

        // Vérifie d'abord si Discord est configuré
        if (config.discord?.enabled) {
            try {
                const response = await nodeFetch(
                    `https://discord.com/api/v10/channels/${config.discord.channelId}/messages?limit=${config.discord.limit || 10}`,
                    {
                        headers: {
                            'Authorization': `Bot ${config.discord.token}`,
                            'Content-Type': 'application/json',
                        }
                    }
                );

                if (response.ok) {
                    const messages = await response.json();
                    return messages.map(message => ({
                        title: this.extractDiscordTitle(message.content),
                        content: message.content,
                        author: message.author.username,
                        publish_date: message.timestamp,
                        attachments: message.attachments
                    }));
                }
                console.error('Échec de récupération des news Discord, passage au mode standard');
            } catch (error) {
                console.error('Erreur Discord:', error);
                // Continue vers les autres méthodes si Discord échoue
            }
        }

        // Si Discord a échoué ou n'est pas configuré, continue avec RSS ou JSON
        if (config.rss) {
            return new Promise((resolve, reject) => {
                nodeFetch(config.rss).then(async config => {
                    if (config.status === 200) {
                        let news = [];
                        let response = await config.text()
                        response = (JSON.parse(convert.xml2json(response, { compact: true })))?.rss?.channel?.item;

                        if (!Array.isArray(response)) response = [response];
                        for (let item of response) {
                            news.push({
                                title: item.title._text,
                                content: item['content:encoded']._text,
                                author: item['dc:creator']._text,
                                publish_date: item.pubDate._text
                            })
                        }
                        return resolve(news);
                    }
                    else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
                }).catch(error => reject({ error }))
            })
        } else {
            return new Promise((resolve, reject) => {
                nodeFetch(news).then(async config => {
                    if (config.status === 200) return resolve(config.json());
                    else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
                }).catch(error => {
                    return reject({ error });
                })
            })
        }
    }

    extractDiscordTitle(content) {
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                return trimmedLine;
            }
        }
        return 'News';
    }
}

export default new Config;