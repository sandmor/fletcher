import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { api } from "./_generated/api"

const http = httpRouter()

http.route({
  path: "/updateJobStatus",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.MODAL_CALLBACK_SECRET
    const authHeader = request.headers.get("x-callback-secret")

    if (!secret || authHeader !== secret) {
      return new Response("Unauthorized", { status: 401 })
    }

    const body = await request.json()

    await ctx.runMutation(api.jobs.updateJob, {
      jobId: body.jobId,
      status: body.status,
      outputUrl: body.outputUrl,
      error: body.error,
    })

    return new Response(null, { status: 200 })
  }),
})

export default http
