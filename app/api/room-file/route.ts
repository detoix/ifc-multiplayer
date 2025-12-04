import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');

    if (!roomId) {
        return NextResponse.json({ error: 'roomId required' }, { status: 400 });
    }

    // In a serverless environment without a database, we can't reliably retrieve the file for a room
    // This handler exists to prevent 404 errors on the client

    return NextResponse.json({ error: 'No file found for this room (Serverless storage not implemented)' }, { status: 404 });
}
