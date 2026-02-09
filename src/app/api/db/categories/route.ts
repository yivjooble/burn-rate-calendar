import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

interface Category {
  id: string;
  userId?: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt?: number;
}

export async function GET() {
  try {
    const userId = await requireAuth();
    
    const categories = await prisma.userCategory.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(categories.map(cat => ({
      id: cat.id,
      userId: cat.userId,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      createdAt: Math.floor(cat.createdAt.getTime() / 1000),
    })));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error getting categories:", error);
    return NextResponse.json({ error: "Failed to get categories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Ensure user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `user_${userId}@placeholder.local`,
        passwordHash: "",
        passwordSalt: "",
      },
    });

    // Handle bulk update (replace all categories)
    if (body.categories && Array.isArray(body.categories)) {
      // Delete existing categories
      await prisma.userCategory.deleteMany({
        where: { userId },
      });

      // Create new categories
      const categories = await Promise.all(
        body.categories.map((cat: Category) =>
          prisma.userCategory.create({
            data: {
              userId,
              id: cat.id,
              name: cat.name,
              color: cat.color || null,
              icon: cat.icon || null,
            },
          })
        )
      );

      return NextResponse.json({ 
        success: true, 
        count: categories.length,
        categories: categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
        })),
      });
    }

    // Handle single category add
    if (body.category) {
      const category = await prisma.userCategory.create({
        data: {
          userId,
          id: body.category.id || `cat_${Date.now()}`,
          name: body.category.name,
          color: body.category.color || null,
          icon: body.category.icon || null,
        },
      });

      return NextResponse.json({ 
        success: true, 
        category: {
          id: category.id,
          name: category.name,
          color: category.color,
          icon: category.icon,
        }
      });
    }

    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error saving categories:", error);
    return NextResponse.json({ error: "Failed to save categories" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get("id");

    if (!categoryId) {
      return NextResponse.json({ error: "Category ID required" }, { status: 400 });
    }

    await prisma.userCategory.deleteMany({
      where: { id: categoryId, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting category:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
