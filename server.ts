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
const port = parseInt(process.env.PORT || "3000", 10);
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer();
    const io = new Server(httpServer);

    const DB_FILE = path.join(process.cwd(), 'room-state.json');
    let roomFiles = new Map<string, { fileUrl: string, filename: string, filePath: string }>();
    const roomOccupancy = new Map<string, number>();

    // Load state from disk
    try {
        console.log('Loading DB from:', DB_FILE);
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            roomFiles = new Map(JSON.parse(data));
            console.log('Loaded room state from disk:', roomFiles.size, 'rooms');
        } else {
            console.log('No DB file found, starting empty');
        }
    } catch (e) {
        console.error('Failed to load room state:', e);
    }

    const saveState = () => {
        try {
            console.log('Saving room state to disk...');
            fs.writeFileSync(DB_FILE, JSON.stringify(Array.from(roomFiles.entries())));
            console.log('Saved room state');
        } catch (e) {
            console.error('Failed to save room state:', e);
        }
    };

    const cleanupRoom = (roomId: string) => {
        const roomFile = roomFiles.get(roomId);
        if (roomFile) {
            console.log(`Cleaning up room ${roomId}: deleting ${roomFile.filename}`);

            // Delete the physical file
            try {
                if (fs.existsSync(roomFile.filePath)) {
                    fs.unlinkSync(roomFile.filePath);
                    console.log(`Deleted file: ${roomFile.filePath}`);
                }
            } catch (err) {
                console.error(`Failed to delete file ${roomFile.filePath}:`, err);
            }

            // Remove from state
            roomFiles.delete(roomId);
            saveState();
            console.log(`Room ${roomId} cleaned up`);
        }
    };

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
                    const filePath = path.join(process.cwd(), 'uploads', file.filename);

                    console.log(`File uploaded for room ${roomId}: ${file.originalname}`);

                    // Store file info for the room
                    roomFiles.set(roomId, { fileUrl, filename: file.originalname, filePath });
                    saveState();

                    // Broadcast to all clients in the room via Socket.IO
                    io.to(roomId).emit('file-uploaded', { fileUrl, filename: file.originalname });

                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 200;
                    res.end(JSON.stringify({ fileUrl, filename: file.originalname }));
                });
                return;
            }

            // Handle getting room file
            if (req.method === 'GET' && parsedUrl.pathname === '/api/room-file') {
                const roomId = parsedUrl.query.roomId as string;
                console.log(`API Request: Get file for room ${roomId}`);

                if (!roomId) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'roomId required' }));
                    return;
                }

                const roomFile = roomFiles.get(roomId);
                if (roomFile) {
                    console.log(`Found file for room ${roomId}: ${roomFile.filename}`);
                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 200;
                    res.end(JSON.stringify(roomFile));
                } else {
                    console.log(`No file found for room ${roomId}`);
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'No file found for this room' }));
                }
                return;
            }

            // Serve uploaded files
            if (parsedUrl.pathname?.startsWith('/uploads/')) {
                const filename = parsedUrl.pathname.replace('/uploads/', '');
                const filePath = path.join(process.cwd(), 'uploads', filename);

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
                const wasmPath = path.join(process.cwd(), 'public', 'wasm', 'web-ifc.wasm');

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

            // Track occupancy
            const currentCount = roomOccupancy.get(roomId) || 0;
            roomOccupancy.set(roomId, currentCount + 1);
            console.log(`Socket ${socket.id} joined room ${roomId} (occupancy: ${currentCount + 1})`);

            // Send current file if exists
            const roomFile = roomFiles.get(roomId);
            if (roomFile) {
                socket.emit('file-uploaded', roomFile);
            }
        });

        socket.on("pointer-update", (data: any) => {
            // data: { roomId, pointer: { x, y, color, label } }
            const { roomId, pointer } = data;
            // Broadcast to everyone else in the room
            socket.to(roomId).emit("pointer-update", { clientId: socket.id, pointer });
        });

        socket.on("selection-update", (data: any) => {
            const { roomId, selection } = data;
            socket.to(roomId).emit("selection-update", { clientId: socket.id, selection });
        });

        socket.on("disconnecting", () => {
            for (const room of socket.rooms) {
                if (room !== socket.id) {
                    socket.to(room).emit("user-disconnected", socket.id);

                    // Decrease occupancy
                    const currentCount = roomOccupancy.get(room) || 0;
                    const newCount = Math.max(0, currentCount - 1);

                    if (newCount === 0) {
                        console.log(`Room ${room} is now empty, cleaning up...`);
                        roomOccupancy.delete(room);
                        cleanupRoom(room);
                    } else {
                        roomOccupancy.set(room, newCount);
                        console.log(`Room ${room} occupancy decreased to ${newCount}`);
                    }
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
