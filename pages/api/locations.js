import { readFileSync } from 'fs';
import { join } from 'path';

const filePath = join(process.cwd(), 'public', 'locations.js');
const jsonData = readFileSync(filePath, 'utf-8');
const locations = JSON.parse(jsonData);

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json(locations);
}