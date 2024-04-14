import { Button, Frog } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
import { neynar as neynarHub } from "frog/hubs";
import { neynar } from "frog/middlewares";
import { handle } from "frog/vercel";
import { CastParamType, NeynarAPIClient } from "@neynar/nodejs-sdk";
import { Box, Heading, Text, VStack, vars } from "../lib/ui.js";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!
const neynarClient = new NeynarAPIClient(NEYNAR_API_KEY);

const ADD_URL =
  `https://warpcast.com/~/add-cast-action?url=${process.env.NEXT_PUBLIC_SITE_URL}/api/interaction`;

export const app = new Frog({
  assetsPath: "/",
  basePath: "/api",
  ui: { vars },
  hub: {
    apiUrl: "https://hubs.airstack.xyz",
    fetchOptions: {
      headers: {
        "x-airstack-hubs": process.env.AIRSTACK_API_KEY ? process.env.AIRSTACK_API_KEY : "",
      }
    }
  },
  browserLocation: ADD_URL,
}).use(
  neynar({
    apiKey: NEYNAR_API_KEY,
    features: ["interactor", "cast"],
  })
);

// Cast action GET handler
app.hono.get("/interaction", async (c) => {
  return c.json({
    name: "Inter Action",
    icon: "eye",
    description: "Check if this user has interacted with your last 100 posts",
    aboutUrl: "https://github.com/gtspencer/inter-action",
    action: {
      type: "post",
    },
  });
});

// Cast action POST handler
app.hono.post("/interaction", async (c) => {
  const {
    trustedData: { messageBytes },
  } = await c.req.json();

  const result = await neynarClient.validateFrameAction(messageBytes);
  if (result.valid) {
    const interactorFid = result.action.interactor.fid

    let casts = await neynarClient.fetchAllCastsCreatedByUser(interactorFid, {
      limit: 100
    })

    const cast = await neynarClient.lookUpCastByHashOrWarpcastUrl(
      result.action.cast.hash,
      CastParamType.Hash
    );
    const {
      cast: {
        author: { fid, username },
      },
    } = cast;
    if (result.action.interactor.fid === fid) {
      return c.json({ message: "Nice try." }, 400);
    }

    
    let reacted = false
    for (let c of casts.result.casts) {
      const reactionFids = c.reactions.fids;
      if (reactionFids.includes(fid)) {
        reacted = true
      }
    }

    let message = `${username} hasn't interacted recently`
    if (reacted) {
      let message = `${username} interacts with you`;
      if (message.length > 30) {
        message = "Interacts with you";
      }
    } else {
      if (message.length > 30) {
        message = "Hasn't interacted recently";
      }
    }

    return c.json({ message });
  } else {
    return c.json({ message: "Unauthorized" }, 401);
  }
});

// Frame handlers
app.frame("/", (c) => {
  return c.res({
    image: (
      <Box
        grow
        alignVertical="center"
        backgroundColor="white"
        padding="32"
        border="1em solid rgb(138, 99, 210)"
      >
        <VStack gap="4">
          <Heading color="fcPurple" align="center" size="64">
            Inter Action
          </Heading>
          <Text color="fcPurple" align="center">Check if a caster has liked any of your last 100 casts</Text>
        </VStack>
      </Box>
    ),
    intents: [
      <Button.Link href={ADD_URL}>Add Action</Button.Link>
    ],
  });
});

// @ts-ignore
// const isEdgeFunction = typeof EdgeFunction !== "undefined";
// const isProduction = isEdgeFunction || import.meta.env?.MODE !== "development";
devtools(app, { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
