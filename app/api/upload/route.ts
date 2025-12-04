import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import pusher from '@/app/lib/pusher';

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;
        const roomId = data.get('roomId') as string || 'default-room';

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Upload to Vercel Blob
        const blob = await put(`${roomId}/${Date.now()}-${file.name}`, file, {
            access: 'public',
        });

        console.log(`Uploaded file to Vercel Blob: ${blob.url} for room ${roomId}`);

        // Notify all clients in the room via Pusher
        await pusher.trigger(`room-${roomId}`, 'file-uploaded', {
            fileUrl: blob.url,
            filename: file.name
        });

        return NextResponse.json({
            fileUrl: blob.url,
            filename: file.name
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
