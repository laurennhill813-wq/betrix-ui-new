// adminPostQueue.js
// Simple Redis-backed admin approval queue for media posts
const { getRedis } = require("../lib/redis-factory.js");
const redis = getRedis();

const QUEUE_KEY = "betrix:admin:post_queue";

async function queuePostForApproval(post) {
  await redis.rpush(QUEUE_KEY, JSON.stringify(post));
}

async function getNextQueuedPost() {
  const raw = await redis.lindex(QUEUE_KEY, 0);
  return raw ? JSON.parse(raw) : null;
}

async function approveQueuedPost() {
  await redis.lpop(QUEUE_KEY);
}

async function getAllQueuedPosts() {
  const all = await redis.lrange(QUEUE_KEY, 0, -1);
  return all.map(j => JSON.parse(j));
}

module.exports = {
  queuePostForApproval,
  getNextQueuedPost,
  approveQueuedPost,
  getAllQueuedPosts
};
