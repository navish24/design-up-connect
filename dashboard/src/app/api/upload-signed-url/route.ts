import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { folder = 'uploads', resource_type = 'image' } = await req.json()

  const apiKey = process.env.CLOUDINARY_API_KEY!
  const apiSecret = process.env.CLOUDINARY_API_SECRET!
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`
  const signature = crypto.createHash('sha1').update(toSign).digest('hex')

  return NextResponse.json({ signature, timestamp, apiKey, cloudName, folder, resource_type })
}
