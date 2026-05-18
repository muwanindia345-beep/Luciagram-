const loki = require('lokijs');
const path = require('path');

const db = new loki(path.join(__dirname, '../luciagram.db.json'), {
  autoload: true,
  autosave: true,
  autosaveInterval: 4000,
});

const getCollection = (name) => {
  return db.getCollection(name) || db.addCollection(name, { indices: ['id'] });
};

const Users = () => getCollection('users');
const Posts = () => getCollection('posts');
const Stories = () => getCollection('stories');
const Comments = () => getCollection('comments');
const Likes = () => getCollection('likes');
const Follows = () => getCollection('follows');
const Messages = () => getCollection('messages');

module.exports = { db, Users, Posts, Stories, Comments, Likes, Follows, Messages };
