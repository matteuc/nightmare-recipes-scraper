const Nightmare = require('nightmare')
const _colors = require('colors');
const cliProgress = require('cli-progress');

const fs = require('fs')

const OUTPUT_PATH = 'generated'

const multibar = new cliProgress.MultiBar({
    format: '{title} |' + '{bar}' + '| {percentage}% || {value}/{total} Recipes',
    hideCursor: true

}, cliProgress.Presets.shades_grey);

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

// TESTED FOR
// https://norecipes.com/
// https://www.justonecookbook.com/
// https://thewoksoflife.com/recipe-list/
async function parseWordPressRecipe(url, instance) {
    await instance.goto(url)

    let currentHeight = 0;

    const totalHeight = await instance.evaluate(function () {
        return document.body.scrollHeight;
    });

    while (totalHeight >= currentHeight) {
        currentHeight += totalHeight * 0.1;

        await instance.scrollTo(currentHeight, 0)
            .wait(100);
    }

    return instance
        .evaluate(
            () => {
                /* 
                    FUNCTIONS START
                */
                const parseNumber = s => !isNaN(s) ? parseFloat(s) : ([n, d] = s.split(/\D/), d) ? (n || 1) / d : '131111121234151357'[i = s.charCodeAt() % 63 % 20] / -~'133689224444557777'[i]

                const normalizeStr = (s = '') => s.trim().toLowerCase()

                const extractImage = i => ({
                    src: i.getAttribute("nitro-lazy-src") || i.getAttribute('src')
                        || '',
                    alt: i.getAttribute('alt')
                })
                /* 
                    FUNCTIONS END
                */

                const recipeName = (document.querySelector('[class*="recipe-name"]') || {}).innerText

                // If a recipe name not found, return
                if (!recipeName) return null

                const recipeSummary = (document.querySelector('[class*="recipe-summary"]') || {}).innerText || ''

                const recipeCourse = normalizeStr((document.querySelector('[class*="recipe-course"]:not([class*="recipe-course-label"]):not([class*="recipe-course-container"])') || {}).innerText)

                const recipeCuisine = normalizeStr((document.querySelector('[class*="recipe-cuisine"]:not([class*="recipe-cuisine-label"]):not([class*="recipe-cuisine-container"])') || {}).innerText)

                const recipePrepTime = (document.querySelector('[class*="prep_time"]') || {}).innerText

                const recipePrepTimeUnit = (document.querySelector('[class*="prep_time-unit"]') || {}).innerText

                const recipeCookTime = (document.querySelector('[class*="cook_time"]') || {}).innerText

                const recipeCookTimeUnit = (document.querySelector('[class*="cook_time-unit"]') || {}).innerText

                const recipeTotalTime = (document.querySelector('[class*="total_time"]') || {}).innerText

                const recipeTotalTimeUnit = (document.querySelector('[class*="total_time-unit"]') || {}).innerText

                const recipeServings = (document.querySelector('[class*="recipe-servings-container"]') || {}).innerText

                let recipeServingSize

                if (recipeServings) {
                    let tmp = recipeServings.split(":")[1]

                    if (!tmp) return

                    tmp = tmp.trim()

                    recipeServingSize = tmp.split(" ")[0]

                }

                const recipeImages = Object.values(
                    document.querySelectorAll('[class*="wp-image"]') || {})
                    .filter(i => {
                        return (extractImage(i).src || "").includes("https")
                    }
                    )
                    .map(i => extractImage(i))

                const recipeIngredients = Object.values(
                    document.querySelectorAll('[class$="recipe-ingredient"]') || {})
                    .map(ri => {
                        const amount = parseNumber(
                            (ri.querySelector('[class*=recipe-ingredient-amount]') || {}).innerText || ''
                        )

                        const unit = (ri.querySelector('[class*=recipe-ingredient-unit]') || {}).innerText

                        const name = normalizeStr(((ri.querySelector('[class*=recipe-ingredient-name]') || {}).innerText || '').replace(/\([^)]*\)/g, ''))

                        return {
                            amount,
                            unit,
                            name
                        }

                    })


                const recipeInstructions = Object.values(
                    document.querySelectorAll('[class$="recipe-instruction"]') || {})
                    .map((ri, idx) => {
                        const description = (ri.querySelector('[class*=recipe-instruction-text]') || {}).innerText

                        const images = Object.values(
                            ri.querySelectorAll('[class*=recipe-instruction-image] img') || {}
                        )
                            .map(i => extractImage(i))

                        return {
                            step: idx + 1,
                            description,
                            images
                        }

                    })

                return {
                    link: document.URL,
                    name: recipeName,
                    summary: recipeSummary,
                    course: recipeCourse,
                    cuisine: recipeCuisine,
                    timing: {
                        prep: {
                            value: parseInt(recipePrepTime),
                            unit: recipePrepTimeUnit
                        },
                        cook: {
                            value: parseInt(recipeCookTime),
                            unit: recipeCookTimeUnit
                        },
                        total: {
                            value: parseInt(recipeTotalTime),
                            unit: recipeTotalTimeUnit
                        },
                    },
                    ingredients: recipeIngredients,
                    instructions: recipeInstructions,
                    images: recipeImages,
                    servings: parseInt(recipeServingSize)
                }
            })
}

const writeAndCleanup = (recipes, prefix, instance) => {
    fs.writeFileSync(`${OUTPUT_PATH}/${prefix}.json`, JSON.stringify(recipes))

    return instance.end()
}

Promise.all([
    scrapeNoRecipes({
        maxCount: 100,
        multibar
    }).then(
        ({ data, instance }) => writeAndCleanup(data, "norecipes_index", instance)
    ),
    scrapeJustOneCookBook({
        maxCount: 100,
        multibar
    }).then(
        ({ data, instance }) => writeAndCleanup(data, "just_one_cookbook_index", instance)
    ),
    scrapeWoksOfLife({
        maxCount: 100,
        multibar
    }).then(
        ({ data, instance }) => writeAndCleanup(data, "woks_of_life_index", instance)
    ),
    scrapePressureCookRecipes({
        maxCount: 100,
        multibar
    }).then(
        ({ data, instance }) => writeAndCleanup(data, "pressure_cook_recipes_index", instance)
    )

]).then(() => multibar.stop())

// WP
// https://www.chinasichuanfood.com/?s=
// https://www.kawalingpinoy.com/category/recipe-index/

// ERS
// https://shesimmers.com/?s=
// http://www.itsmydish.com/?s=

// ZL
// https://www.japanesecooking101.com/?s=
// https://ladyandpups.com/?s=

// WPURP
// https://hispanickitchen.com/?s=