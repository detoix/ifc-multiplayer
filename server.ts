const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
        cb(null, 'uploads/');
    },
    filename: (req: any, file: any, cb: any) => {
        // Keep original filename with timestamp to avoid conflicts
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer();
    const io = new Server(httpServer);

    // Set up HTTP request handler
    httpServer.on('request', async (req: any, res: any) => {
        try {
            const parsedUrl = parse(req.url!, true);

            // Handle file upload
            if (req.method === 'POST' && parsedUrl.pathname === '/api/upload') {
                upload.single('file')(req, res, (err: any) => {
                    if (err) {
                        console.error('Upload error:', err);
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: 'Upload failed' }));
                        return;
                    }
                    const file = (req as any).file;
                    if (!file) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: 'No file uploaded' }));
                        return;
                    }
                    const roomId = (req as any).body?.roomId || 'default-room';
                    const fileUrl = `/uploads/${file.filename}`;

                    // Broadcast to all clients in the room via Socket.IO
                    io.to(roomId).emit('file-uploaded', { fileUrl, filename: file.originalname });

                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 200;
                    res.end(JSON.stringify({ fileUrl, filename: file.originalname }));
                });
                return;
            }

            // Serve uploaded files
            if (parsedUrl.pathname?.startsWith('/uploads/')) {
                const filename = parsedUrl.pathname.replace('/uploads/', '');
                const filePath = path.join(__dirname, 'uploads', filename);

                fs.readFile(filePath, (err: any, data: any) => {
                    if (err) {
                        console.error('Error reading uploaded file:', err);
                        res.statusCode = 404;
                        res.end('File not found');
                        return;
                    }
                    res.setHeader('Content-Type', 'application/octet-stream');
                    res.setHeader('Content-Length', data.length);
                    res.statusCode = 200;
                    res.end(data);
                });
                return;
            }

            // Handle WASM file requests - both direct and via _next
            if (parsedUrl.pathname?.includes('web-ifc.wasm')) {
                const wasmPath = path.join(__dirname, 'public', 'wasm', 'web-ifc.wasm');

                fs.readFile(wasmPath, (err: any, data: any) => {
                    if (err) {
                        console.error('Error reading WASM file:', err);
                        res.statusCode = 404;
                        res.end('WASM file not found');
                        return;
                    }
                    res.setHeader('Content-Type', 'application/wasm');
                    res.setHeader('Content-Length', data.length);
                    res.statusCode = 200;
                    res.end(data);
                });
                return;
            }

            // IMPORTANT: Skip Socket.IO routes - Socket.IO handles these internally
            // If we pass these to Next.js, it will return 404
            if (parsedUrl.pathname?.startsWith('/socket.io')) {
                return; // Let Socket.IO's own handler deal with this
            }

            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error("Error occurred handling", req.url, err);
            res.statusCode = 500;
            res.end("internal server error");
        }
    });

    io.on("connection", (socket: any) => {
        console.log("Client connected", socket.id);

        socket.on("join-room", (roomId: string) => {
            socket.join(roomId);
            console.log(`Socket ${socket.id} joined room ${roomId}`);
        });

        socket.on("pointer-update", (data: any) => {
            // data: { roomId, pointer: { x, y, color, label } }
            const { roomId, pointer } = data;
            // Broadcast to everyone else in the room
            socket.to(roomId).emit("pointer-update", { clientId: socket.id, pointer });
        });

        socket.on("disconnecting", () => {
            for (const room of socket.rooms) {
                if (room !== socket.id) {
                    socket.to(room).emit("user-disconnected", socket.id);
                }
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected", socket.id);
        });
    });

    httpServer
        .once("error", (err: Error) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
