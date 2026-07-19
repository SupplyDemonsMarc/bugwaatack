const { Server } = require('socket.io');

module.exports = (req, res) => {
    if (!res.socket.server.io) {
        const io = new Server(res.socket.server);
        res.socket.server.io = io;

        io.on('connection', (socket) => {
            console.log('🔥 Client connected');
            
            socket.on('disconnect', () => {
                console.log('💀 Client disconnected');
            });
        });
    }
    res.end();
};
