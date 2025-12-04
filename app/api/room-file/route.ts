import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');

    if (!roomId) {
        return NextResponse.json({ error: 'roomId required' }, { status: 400 });
    }

    try {
        // List files in the room's folder in Vercel Blob
        const { blobs } = await list({ prefix: `${roomId}/` });

        if (blobs.length === 0) {
            return NextResponse.json({ error: 'No file found for this room' }, { status: 404 });
        }

        // Get the most recent file (last uploaded)
        const latestBlob = blobs.sort((a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )[0];

        // Extract original filename from the path (format: roomId/timestamp-filename.ifc)
        const pathParts = latestBlob.pathname.split('/');
        const storedName = pathParts[pathParts.length - 1];
        const filename = storedName.replace(/^\d+-/, ''); // Remove timestamp prefix

        return NextResponse.json({
            fileUrl: latestBlob.url,
            filename: filename
        });
    } catch (error) {
        console.error('Error listing blobs:', error);
        return NextResponse.json({ error: 'Failed to fetch room file' }, { status: 500 });
    }
}
