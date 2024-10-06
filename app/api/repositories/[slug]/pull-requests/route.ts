import { NextResponse } from 'next/server'
import { getOctokit } from '@/lib/github'
import { getGitlabClient } from '@/lib/gitlab'
import { db } from '@/lib/db/drizzle'
import { repositories } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { PullRequest } from '@/app/(dashboard)/dashboard/types'

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params
  const { searchParams } = new URL(request.url)
  const providerParam = searchParams.get('provider')

  try {
    let repoProvider = providerParam

    // If provider is not in URL, fetch from database
    if (!repoProvider) {
      let repoData = await db.query.repositories.findFirst({
        where: eq(repositories.id, slug),
      })
      repoProvider = repoData?.provider
    }

    // Validate provider if it's not null
    if (repoProvider && repoProvider !== 'github' && repoProvider !== 'gitlab') {
      return NextResponse.json({ error: 'Wrong Git Provider Provided' }, { status: 400 })
    }

    let pullRequests: PullRequest[]
    if (repoProvider === 'gitlab') {
      const gitlabClient = await getGitlabClient()
      const mergeRequests = await gitlabClient.MergeRequests.all({ projectId: slug, state: 'opened' })
      pullRequests = mergeRequests.map(mr => ({
        id: mr.id,
        number: mr.iid,
        title: mr.title,
        buildStatus: 'pending', // You may need to fetch this separately
        isDraft: mr.work_in_progress,
        branchName: mr.source_branch,
        source: 'gitlab',
        repository: {
          id: parseInt(slug),
          name: mr.project_id.toString(),
          full_name: `${mr.project_id}`,
          owner: {
            login: mr.author.username
          }
        },
        html_url: mr.web_url,
        user: {
          login: mr.author.username
        },
        created_at: mr.created_at
      }))
    } else if (repoProvider === 'github') {
      const octokit = await getOctokit()

      // Fetch repository info from the database
      let repoData = await db.query.repositories.findFirst({
        where: eq(repositories.id, slug),
      })

      let fullPath = repoData?.fullPath

      // If repoData is not available in the database, fetch from GitHub API
      if (!fullPath) {
        try {
          const { data: repoInfo } = await octokit.rest.repos.getById({
            repo_id: parseInt(slug),
          })
          fullPath = `${repoInfo.owner.login}/${repoInfo.name}`

          // Optionally, store the fetched fullPath in the database for future requests
          await db.update(repositories)
            .set({ fullPath: fullPath })
            .where(eq(repositories.id, slug))
        } catch (githubError) {
          console.error('GitHub API error:', githubError)
          return NextResponse.json({ error: 'Failed to fetch GitHub repository details' }, { status: 500 })
        }
      }

      // Split fullPath to get owner and repo
      const [owner, repo] = fullPath.split('/')

      try {
        const { data } = await octokit.rest.pulls.list({
          owner,
          repo,
          state: 'open',
          per_page: 100
        })
        pullRequests = data.map(pr => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          buildStatus: 'pending', // You may need to fetch this separately
          isDraft: pr.draft,
          branchName: pr.head.ref,
          source: 'github',
          repository: {
            id: pr.base.repo.id,
            name: pr.base.repo.name,
            full_name: pr.base.repo.full_name,
            owner: {
              login: pr.base.repo.owner.login
            }
          },
          html_url: pr.html_url,
          user: {
            login: pr.user?.login || 'Unknown'
          },
          created_at: pr.created_at
        }))
      } catch (githubError) {
        console.error('GitHub API error:', githubError)
        return NextResponse.json({ error: 'Failed to fetch GitHub pull requests' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'Provider not specified' }, { status: 400 })
    }

    // Update the repository in the database with the latest open pull request count
    await db.update(repositories)
      .set({ openPullRequests: pullRequests.length, updatedAt: new Date() })
      .where(eq(repositories.id, slug))

    return NextResponse.json(pullRequests)
  } catch (error) {
    console.error('Error fetching pull requests:', error)
    return NextResponse.json({ error: 'Failed to fetch pull requests' }, { status: 500 })
  }
}