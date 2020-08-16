const Nightmare = require('nightmare')
const cliProgress = require('cli-progress');

async function scrapeJustOneCookBook({
    maxCount = 5,
    multibar
} = {}) {
    /*
        INSTANCES START
    */
    const instance = Nightmare({
        openDevTools: true,
        show: true
    })

    /*
        INSTANCES END
    */
    const recipePages = []

    const maxPageNumber = await instance
        .goto('https://www.justonecookbook.com/recipes')
        .evaluate(() => {
            const matches = document.querySelectorAll('a.page-numbers:not(.next)')

            const pageButtons = Object.keys(matches).map(k => matches[k].text)

            return parseInt(pageButtons.pop())
        })

    for (let i = 1; i <= maxPageNumber; i++) {
        recipePages.push(`https://www.justonecookbook.com/recipes${i !== 1 ? `/page/${i}` : ''}`)
    }

    const allRecipeLinks = await recipePages
        .reduce(async (accumulator, url) => {


            const prevRecipeLinks = await accumulator;

            if (prevRecipeLinks.length >= maxCount) return prevRecipeLinks

            const parsedRecipeLinks = await instance.goto(url)
                .evaluate(() => {
                    const matches = document.querySelectorAll('.grid.thumb a[rel="bookmark"]')

                    return Object.keys(matches).map(k => matches[k].href)

                })

            return prevRecipeLinks.concat(parsedRecipeLinks)

        }, Promise.resolve([]))

    const recipesToParse = allRecipeLinks.slice(0, maxCount)

    let totalNumRecipes = recipesToParse.length

    const progressBar = multibar ? multibar.create(totalNumRecipes, 0) : (new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)).start(recipesToParse.length, 0);

    const allRecipeInfo = await recipesToParse
        .reduce(async (accumulator, url) => {

            const prevRecipeInfo = await accumulator;

            const parsedRecipeInfo = await parseWordPressRecipe(url, instance)

            const updateObj = { title: 'JustOneCookbook' }

            if (!parsedRecipeInfo) progressBar.setTotal(--totalNumRecipes)

            progressBar.update(prevRecipeInfo.length + 1, updateObj);
            return prevRecipeInfo.concat(parsedRecipeInfo ? [parsedRecipeInfo] : [])

        }, Promise.resolve([]))

    progressBar.stop()

    return { data: allRecipeInfo, instance }

    // https://stackoverflow.com/questions/40832949/how-to-end-instancejs-instance-after-chaining-promises
}

async function scrapePressureCookRecipes({
    maxCount = 5,
    multibar
} = {}) {
    /*
        INSTANCES START
    */
    const instance = Nightmare({
        openDevTools: true,
        show: true
    })

    /*
        INSTANCES END
    */
    const recipePages = []

    const domain = 'https://www.pressurecookrecipes.com/instant-pot-recipes/'

    const maxPageNumber = await instance
        .goto(domain)
        .evaluate(() => {
            const matches = document.querySelectorAll('a.page-numbers:not(.next)')

            const pageButtons = Object.keys(matches).map(k => matches[k].text)

            return parseInt(pageButtons.pop())
        })

    for (let i = 1; i <= maxPageNumber; i++) {
        recipePages.push(`${domain}${i !== 1 ? `/page/${i}` : ''}`)
    }

    const allRecipeLinks = await recipePages
        .reduce(async (accumulator, url) => {


            const prevRecipeLinks = await accumulator;

            if (prevRecipeLinks.length >= maxCount) return prevRecipeLinks

            const parsedRecipeLinks = await instance.goto(url)
                .evaluate(() => {
                    const matches = document.querySelectorAll('a.mask-img')

                    return Object.keys(matches).map(k => matches[k].href)

                })

            return prevRecipeLinks.concat(parsedRecipeLinks)

        }, Promise.resolve([]))

    const recipesToParse = allRecipeLinks.slice(0, maxCount)

    let totalNumRecipes = recipesToParse.length

    const progressBar = multibar ? multibar.create(totalNumRecipes, 0) : (new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)).start(recipesToParse.length, 0);

    const allRecipeInfo = await recipesToParse
        .reduce(async (accumulator, url) => {

            const prevRecipeInfo = await accumulator;

            const parsedRecipeInfo = await parseWordPressRecipe(url, instance)

            const updateObj = { title: 'Amy & Jacky | Pressure Cook Recipes' }

            if (!parsedRecipeInfo) progressBar.setTotal(--totalNumRecipes)

            progressBar.update(prevRecipeInfo.length + 1, updateObj);
            return prevRecipeInfo.concat(parsedRecipeInfo ? [parsedRecipeInfo] : [])

        }, Promise.resolve([]))

    progressBar.stop()

    return { data: allRecipeInfo, instance }

    // https://stackoverflow.com/questions/40832949/how-to-end-instancejs-instance-after-chaining-promises
}

async function scrapeNoRecipes({
    maxCount = 5,
    multibar
} = {}) {
    /*
       INSTANCES START
   */
    const instance = Nightmare({
        openDevTools: true,
        show: true
    })

    /*
           INSTANCES END
       */
    const allRecipeLinks = await instance
        .goto('https://norecipes.com/recipes/')
        .evaluate((maxCount) => {
            const recipePages = []

            while (recipePages.length <= maxCount) {
                document.querySelector("a.load-more-btn").click();

                recipePages.push(
                    ...(() => {

                        const matches = document.querySelectorAll("a.recipe-link")

                        return Object.keys(matches)
                            .map(k => matches[k].href || '')

                    })()
                );
            }

            return recipePages
        }, maxCount)
        .then(r => r)

    const recipesToParse = allRecipeLinks.slice(0, maxCount)

    let totalNumRecipes = recipesToParse.length

    const progressBar = multibar ? multibar.create(totalNumRecipes, 0) : (new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)).start(recipesToParse.length, 0);

    const allRecipeInfo = await recipesToParse
        .reduce(async (accumulator, url) => {

            const prevRecipeInfo = await accumulator;

            const parsedRecipeInfo = await parseWordPressRecipe(url, instance)

            const updateObj = { title: 'NoRecipe' }

            if (!parsedRecipeInfo) progressBar.setTotal(--totalNumRecipes)

            progressBar.update(prevRecipeInfo.length + 1, updateObj);

            return prevRecipeInfo.concat(parsedRecipeInfo ? [parsedRecipeInfo] : [])

        }, Promise.resolve([]))

    progressBar.stop()

    return { data: allRecipeInfo, instance }

}

async function scrapeWoksOfLife({
    maxCount = 5,
    multibar
} = {}) {
    /*
        INSTANCES START
    */
    const instance = Nightmare({
        openDevTools: true,
        show: true
    })

    /*
        INSTANCES END
    */
    const recipePages = []

    const domain = "https://thewoksoflife.com/recipe-list/"

    const categoryPages = await instance
        .goto(domain)
        .evaluate(() => {
            const matches = document.querySelectorAll('a.seemore')

            const categoryLinks = Object.keys(matches).map(k => matches[k].href)

            return categoryLinks
        })

    recipePages.push(...categoryPages)

    const allRecipeLinks = await recipePages
        .reduce(async (accumulator, url) => {


            const prevRecipeLinks = await accumulator;

            if (prevRecipeLinks.length >= maxCount) return prevRecipeLinks

            const parsedRecipeLinks = await instance.goto(url)
                .evaluate(() => {
                    const matches = document.querySelectorAll('li.kd-ind-list a')

                    return Object.keys(matches).map(k => matches[k].href)

                })


            return prevRecipeLinks.concat(parsedRecipeLinks)

        }, Promise.resolve([]))


    const recipesToParse = allRecipeLinks.slice(0, maxCount)

    let totalNumRecipes = recipesToParse.length

    const progressBar = multibar ? multibar.create(totalNumRecipes, 0) : (new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)).start(recipesToParse.length, 0);

    const allRecipeInfo = await recipesToParse
        .reduce(async (accumulator, url) => {

            const prevRecipeInfo = await accumulator;

            const parsedRecipeInfo = await parseWordPressRecipe(url, instance)

            const updateObj = { title: 'The Woks of Life' }

            if (!parsedRecipeInfo) progressBar.setTotal(--totalNumRecipes)

            progressBar.update(prevRecipeInfo.length + 1, updateObj);
            return prevRecipeInfo.concat(parsedRecipeInfo ? [parsedRecipeInfo] : [])

        }, Promise.resolve([]))

    progressBar.stop()

    return { data: allRecipeInfo, instance }

    // https://stackoverflow.com/questions/40832949/how-to-end-instancejs-instance-after-chaining-promises
}