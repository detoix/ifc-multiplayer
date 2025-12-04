import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;
        const roomId = data.get('roomId') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Use /tmp for Vercel compatibility (ephemeral)
        const uploadDir = tmpdir();
        const uniqueName = `${Date.now()}-${file.name}`;
        const filePath = join(uploadDir, uniqueName);

        await writeFile(filePath, buffer);
        console.log(`Uploaded file to ${filePath} for room ${roomId}`);

        // Note: This state is not shared with other requests in serverless
        // This is just to prevent the 405 error and allow the client to proceed

        return NextResponse.json({
            fileUrl: `/api/file/${uniqueName}`,
            filename: file.name
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
