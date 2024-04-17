import { ConvexError, v } from "convex/values";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { getUser } from "./users";
import { fileType } from "./schema";

export const generateUploadUrl = mutation(async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError("You must be logged in to upload a file!");
  }

  return await ctx.storage.generateUploadUrl();
});

export const hasAccessToOrg = async (
  tokenIdentifier: string,
  ctx: QueryCtx | MutationCtx,
  orgId: string
) => {
  const user = await getUser(ctx, tokenIdentifier);

  const hasAccess =
    user.orgIds.includes(orgId) || user.tokenIdentifier.includes(orgId);

  return hasAccess;
};

export const createFile = mutation({
  args: {
    name: v.string(),
    type: fileType,
    fileId: v.id("_storage"),
    orgId: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError("You must be logged in to upload a file!");
    }

    const hasAccess = hasAccessToOrg(identity.tokenIdentifier, ctx, args.orgId);

    if (!hasAccess) {
      throw new ConvexError("You do not have access to this organization");
    }

    await ctx.db.insert("files", {
      name: args.name,
      type: args.type,
      orgId: args.orgId,
      fileId: args.fileId,
    });
  },
});

export const getFiles = query({
  args: {
    orgId: v.string(),
    query: v.optional(v.string()),
    favorites: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const hasAccess = hasAccessToOrg(identity.tokenIdentifier, ctx, args.orgId);

    if (!hasAccess) {
      return [];
    }

    let files = await ctx.db
      .query("files")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    const query = args.query;

    if (query) {
      files = files.filter((files) =>
        files.name.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (args.favorites) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) =>
          q.eq("tokenIdentifier", identity.tokenIdentifier)
        )
        .first();

      if (!user) {
        throw new ConvexError("No user found!");
      }

      const favorites = await ctx.db
        .query("favorites")
        .withIndex("by_userId_orgId_fileId", (q) =>
          q.eq("userId", user._id).eq("orgId", args.orgId)
        )
        .collect();

      files = files.filter((file) =>
        favorites.some((fav) => fav.fileId === file._id)
      );
    }

    return files;
  },
});

export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("You must be logged in to upload a file!");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new ConvexError("This file does not exist!");
    }

    const hasAccess = hasAccessToOrg(identity.tokenIdentifier, ctx, file.orgId);

    if (!hasAccess) {
      throw new ConvexError("You do not have access to delete this file!");
    }

    await ctx.db.delete(args.fileId);
  },
});

export const toggleFavorite = mutation({
  args: { fileId: v.id("files") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("You must be logged in to upload a file!");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new ConvexError("This file does not exist!");
    }

    const hasAccess = hasAccessToOrg(identity.tokenIdentifier, ctx, file.orgId);

    if (!hasAccess) {
      throw new ConvexError("You do not have access to delete this file!");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (!user) {
      throw new ConvexError("No user found!");
    }

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_userId_orgId_fileId", (q) =>
        q.eq("userId", user._id).eq("orgId", file.orgId).eq("fileId", file._id)
      )
      .first();

    if (!favorites) {
      await ctx.db.insert("favorites", {
        fileId: file._id,
        orgId: file.orgId,
        userId: user._id,
      });
    } else {
      await ctx.db.delete(favorites._id);
    }
  },
});
