app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', require('./backend/api/static-json-proxy'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
