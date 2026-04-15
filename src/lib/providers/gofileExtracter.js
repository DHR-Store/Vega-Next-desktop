import axios from 'axios';

export async function gofileExtracter(id) {
  try {
    await axios.get('https://gofile.io/d/' + id);
    const genAccountres = await axios.post('https://api.gofile.io/accounts');
    const token = genAccountres.data.data.token;

    const wtRes = await axios.get('https://gofile.io/dist/js/global.js');
    const wt = wtRes.data.match(/appdata\.wt\s*=\s*["']([^"']+)["']/)[1];

    const res = await axios.get(`https://api.gofile.io/contents/${id}?wt=${wt}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const oId = Object.keys(res.data.data.children)[0];
    const link = res.data.data.children[oId].link;
    return { link, token };
  } catch (e) {
    console.error('gofile extracter err', e);
    return { link: '', token: '' };
  }
}