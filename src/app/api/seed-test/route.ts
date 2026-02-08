import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

// Hash password using scrypt (same as in src/auth.ts)
function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export async function POST(request: Request) {
  try {
    // Simple auth - only allow if secret matches
    const body = await request.json();
    const { secret } = body;
    
    if (secret !== process.env.NEXTAUTH_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = "test@burnrate.app";
    const password = "test123456";

    // Hash password
    const { hash, salt } = hashPassword(password);

    // Create or update user
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: hash,
        passwordSalt: salt,
        emailVerified: true,
        totpEnabled: false,
      },
      create: {
        email,
        passwordHash: hash,
        passwordSalt: salt,
        emailVerified: true,
        totpEnabled: false,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
      credentials: {
        email,
        password,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
