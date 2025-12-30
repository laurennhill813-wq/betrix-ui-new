// pexelsProvider.js
// Pexels API integration for photos and videos

var axios = require("axios");

var API_KEY = process.env.PEXELS_API_KEY || "azPRTiiyT5Ga6IeZydwUoLOXISQgFgemLkr20MG6";
var BASE_URL = "https://api.pexels.com/v1";
var VIDEO_URL = "https://api.pexels.com/videos";

function pickBestPhoto(photos) {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  var p = photos[0];
  return (
    (p.src && (p.src.large2x || p.src.large || p.src.medium || p.src.original)) ||
    null
  );
}

function pickBestVideo(videos) {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  var v = videos[0];
  if (v.video_files && v.video_files.length > 0) {
    return v.video_files.sort(function(a, b) { return b.width - a.width; })[0].link;
  }
  return null;
}

function getImageForEvent(opts) {
  opts = opts || {};
  var event = opts.event || {};
  var match = opts.match || {};
  var query = event.team || event.player || match.home || match.away || "sports";
  return axios.get(BASE_URL + "/search", {
    headers: { Authorization: API_KEY },
    params: { query: query, per_page: 1 },
    timeout: 10000,
  })
    .then(function(resp) {
      var url = pickBestPhoto(resp.data.photos);
      if (url) return { imageUrl: url, provider: "pexels" };
      return null;
    })
    .catch(function() { return null; });
}

function getVideoForEvent(opts) {
  opts = opts || {};
  var event = opts.event || {};
  var match = opts.match || {};
  var query = event.team || event.player || match.home || match.away || "sports";
  return axios.get(VIDEO_URL + "/search", {
    headers: { Authorization: API_KEY },
    params: { query: query, per_page: 1 },
    timeout: 10000,
  })
    .then(function(resp) {
      var url = pickBestVideo(resp.data.videos);
      if (url) return { videoUrl: url, provider: "pexels" };
      return null;
    })
    .catch(function() { return null; });
}

function getImageForMatch(opts) {
  opts = opts || {};
  return getImageForEvent({ match: opts.match });
}

module.exports = {
  getImageForEvent: getImageForEvent,
  getImageForMatch: getImageForMatch,
  getVideoForEvent: getVideoForEvent
};
