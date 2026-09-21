const axios = require('axios');
const COOKIE = "_ga=GA1.1.1215922175.1774785365; session=7533b5bf-14fc-4a31-bf5a-acf244e743a0; session.sig=4YK-k7KRIZLNJXjPFN_ePrgPxhY; _ga_GDNE9EKYHZ=GS2.1.s1774785364$o1$g1$t1774786796$j60$l0$h0";
const HEADERS = {
    'authority': 'congdong.ff.garena.vn',
    'accept': 'application/json, text/plain, /',
    'content-type': 'application/json',
    'cookie': COOKIE,
    'origin': 'https://congdong.ff.garena.vn',
    'referer': 'https://congdong.ff.garena.vn/tinh-diem',
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
};

const garenaApi = {
    findMatches: async (accountId, start, end) => {
        const payload = { accountId, startTime: start.unix(), endTime: end.unix() };
        const response = await axios.post('https://congdong.ff.garena.vn/league-score-api/player/find-match', payload, { headers: HEADERS });
        return response.data?.matches;
    },
getMatchDetails: async (matchObjects) => {
    const promises = matchObjects.map(obj =>
      axios.post(
        'https://congdong.ff.garena.vn/league-score-api/match',
        { matchId: obj.id }, 
        { headers: HEADERS }
      )
      .then(res => {
        
        console.log(`MATCH DETAIL DATA id=${obj.id}:`, res.data);
        
        return res.data?.match || res.data?.matchDetail || res.data?.data?.match || null;
      })
      .catch(err => {
        console.error(`Error getMatchDetails id=${obj.id}:`, err.response?.data || err.message);
        return null;
      })
    );

    const responses = await Promise.all(promises);
    return responses.filter(Boolean); 
  }
};

module.exports = garenaApi;