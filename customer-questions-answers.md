# Communication Project: Customer Question Answers

## Question 1

> Hello,
>
> I'm new to search engines, and there are a lot of concepts I'm not educated on. To make my onboarding smoother, it'd help if you could provide me with some definitions of the following concepts:
>
> - Records
> - Indexing
>
> I'm also struggling with understanding what types of metrics would be useful to include in the "Custom Ranking."
>
> Cheers, George

**Answer:**

Hey George,

Happy to clarify.

A record is just one searchable item in your index, think one restaurant or one product. Each record is made up of attributes (name, price, category, whatever fields matter to you). More info here: https://www.algolia.com/doc/guides/sending-and-managing-data/prepare-your-data

Indexing is the process of sending those records into Algolia so they're searchable. You push your data in (via the dashboard or via API), Algolia processes and stores it, and from that point on it's queryable. More info here: https://www.algolia.com/doc/guides/sending-and-managing-data/send-and-update-your-data/

For custom ranking, think of it as your tiebreaker. Algolia first ranks results by relevance (typos, word matches, etc.), and once two results are equally relevant, custom ranking decides who wins. Good metrics to use are things like popularity (views, sales, or bookings), ratings, or recency. Numeric or boolean fields work best, if you're tracking something like "number of reviews" or "is featured," those are exactly the kind of attributes to use. More info here: https://www.algolia.com/doc/guides/managing-results/must-do/custom-ranking

Go ahead and book some time with me and we can walk through setting these up: [calendar link]

Ayan

---

## Question 2

> Hello,
>
> Sorry to give you the kind of feedback that I know you do not want to hear, but I really hate the new dashboard design. Clearing and deleting indexes are now several clicks away. I am needing to use these features while iterating, so this is inconvenient.
>
> Regards, Matt

**Answer:**

Hey Matt,

Thank you for flagging this, feedback like this is super useful to us.

Heard on the friction, I'm going to pass this along to our product team as a workflow pain point.

In the meantime if it's helpful, our APIs also support clearing an index programmatically with `POST /indexes/{indexName}/clear`, so you could use that in your workflow and skip the dashboard clicks entirely: https://www.algolia.com/doc/api-reference/api-methods/clear-objects/

Happy to jump on a call to set that up: [calendar link]

Ayan

---

## Question 3

> Hi,
>
> I'm looking to integrate Algolia in my website. Will this be a lot of development work for me? What's the high level process look like?
>
> Regards, Leo

**Answer:**

Hey Leo,

Thanks for reaching out! It's usually less work than people expect. Most teams have a fully working search live within 1-10 days, and simple setups can take as little as 5 minutes to get running. More complex implementations (custom data pipelines, heavy personalization) can take a few weeks. More on that here: https://support.algolia.com/hc/en-us/articles/4406981894033-How-long-does-it-take-to-implement-Algolia

At a high level, there are three steps:

1. Get your data into Algolia (indexing)
2. Configure how you want search to behave (what's searchable, what's filterable, ranking)
3. Build the search UI on your site

For step 3, we've got InstantSearch, which gives you pre-built customizable search components so that you're not building search UI from scratch: https://www.algolia.com/doc/guides/get-started/quickstart

If you're on a platform like Shopify, we've got existing integrations that can really speed up getting up and running: https://www.algolia.com/developers/integrations

If you've got a custom stack, it's more hands-on, but our API clients handle the heavy lifting.

Want to hop on a quick call to scope this out for your specific setup? I took a look at your site and have a few thoughts on where Algolia could fit in nicely: [calendar link]

Ayan
