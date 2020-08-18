const Nightmare = require('nightmare')
const cliProgress = require('cli-progress');
const moment = require('moment')
const parseDuration = require('parse-duration')
const { parse: parseIngredient } = require('recipe-ingredient-parser-v2');

const fs = require('fs')


const OUTPUT_PATH = 'generated'

const DEFAULT_TIMEOUT = 5000

const multibar = new cliProgress.MultiBar({
    format: '{title} |' + '{bar}' + '| {percentage}% || {value}/{total} Recipes',
    hideCursor: true

}, cliProgress.Presets.shades_grey);

async function scrapeRecipeWebsite({
    maxCount = 1,
    name = 'Recipes',
    url,
    show = false,
    devTools = false,
    multibar = null,
    categoryLinkSelector,
    recipeLinkSelector,
    seeMoreRecipesSelector,
} = {}) {
    // START: ERROR HANDLING
    if (!url) throw new Error('NoWebsiteEntryPointException: To scrape recipes, please provide a starting URL for the website you want to scrape recipes from.')

    const recipeSelectorContainsAnchor =
        recipeLinkSelector.split(" ").includes('a') ||
        recipeLinkSelector.split(".").includes('a') ||
        recipeLinkSelector.split("#").includes('a')

    if (!recipeLinkSelector || !recipeSelectorContainsAnchor) throw new Error('NoRecipeLinkSelectorException: To scrape recipes, please provide a CSS selector to identify links (anchor tags) to recipe pages.')

    if (categoryLinkSelector) {
        const categorySelectorContainsAnchor =
            categoryLinkSelector.split(" ").includes('a') ||
            categoryLinkSelector.split(".").includes('a') ||
            categoryLinkSelector.split("#").includes('a')

        if (!categorySelectorContainsAnchor) throw new Error('NoCategoryLinkSelectorException: To scrape recipes, please provide a CSS selector to identify links (anchor tags) to recipe category pages.')
    }
    // END: ERROR HANDLING

    const instance = Nightmare({
        openDevTools: devTools,
        show,
        waitTimeout: 5000,
        // webPreferences: {
        //     images: true,
        //     webgl: false
        // }
    })

    try {

        // START: SCRAPE STARTING URL FOR RECIPE CATEGORY PAGES
        const recipeListPages = []

        if (categoryLinkSelector) {
            const categoryPages = await instance
                .goto(url)
                .evaluate((categoryLinkSelector) => {
                    const matches = document.querySelectorAll(categoryLinkSelector)

                    const categoryLinks = Object.keys(matches).map(k => matches[k].href)

                    return categoryLinks
                }, categoryLinkSelector)

            recipeListPages.push(...categoryPages)
        } else recipeListPages.push(url)
        // END: SCRAPE STARTING URL FOR RECIPE CATEGORY PAGES

        // START: SCRAPE RECIPE LINKS FROM SCRAPED RECIPE CATEGORY PAGES
        const allRecipeLinks = await recipeListPages
            .reduce(async (accumulator, url) => {

                const prevRecipeLinks = await accumulator;

                if (prevRecipeLinks.length >= maxCount) return prevRecipeLinks

                const remaining = maxCount - prevRecipeLinks.length

                const parsedRecipeLinks = []

                let currentUrl = url;


                //     let originalHeight = 0
                //     let currentHeight = 0
                while (parsedRecipeLinks.length <= remaining) {

                    await instance.goto(currentUrl)

                    // START: Handle Infinite Scrolling
                    //     .evaluate(() => document.body.scrollHeight)
                    // if (!originalHeight) {
                    //     originalHeight = await instance.goto(currentUrl)
                    // }

                    // if (currentHeight < originalHeight) await handleScrollThrough(instance, currentHeight)

                    // currentHeight = originalHeight
                    // END: Handle Infinite Scrolling

                    let uniqueRecipes = []
                    try {
                        const { data, next } = await instance
                            .evaluate(async (remaining, recipeLinkSelector, seeMoreRecipesSelector) => {

                                const findRecipeLinks = () => {

                                    const matches = document.querySelectorAll(recipeLinkSelector)

                                    return Object.keys(matches)
                                        .map(k => matches[k].href || '')

                                }

                                const recipePages = []

                                recipePages.push(
                                    ...findRecipeLinks()
                                );


                                const seeMoreButton = document.querySelector(seeMoreRecipesSelector)

                                while (seeMoreButton && recipePages.length <= remaining) {

                                    const nextPageLink = seeMoreButton.getAttribute('href')

                                    // If the see more button does not travel to a new page, click to load more recipes
                                    if (
                                        !nextPageLink ||
                                        !nextPageLink.startsWith('http')
                                    ) {
                                        seeMoreButton.click()

                                        // Wait for resources to load (WIP)
                                        await new Promise(resolve => setTimeout(resolve, 2000))

                                        const newRecipeLinks = findRecipeLinks().filter(f => !recipePages.includes(f))

                                        if (!newRecipeLinks.length) break;

                                        recipePages.push(
                                            ...newRecipeLinks
                                        );
                                    }

                                    // Otherwise, handle traveling to the new page
                                    else if (nextPageLink.startsWith('http')) {
                                        return {
                                            data: recipePages,
                                            next: nextPageLink
                                        }
                                    }


                                }

                                return { data: recipePages, next: null }

                            }, remaining, recipeLinkSelector, seeMoreRecipesSelector)


                        uniqueRecipes.push(...data.filter(r => !parsedRecipeLinks.includes(r)))

                        parsedRecipeLinks.push(...uniqueRecipes)

                        if (next) currentUrl = next
                        else break;
                    } catch (e) {
                        if (!(e.message || '').toLowerCase().includes('timed out')) break
                        continue
                    }

                }

                return prevRecipeLinks.concat(parsedRecipeLinks)
            }, Promise.resolve([]))
        // END: SCRAPE RECIPE LINKS FROM SCRAPED RECIPE CATEGORY PAGES

        // REDUCE NUMBER OF RECIPES TO PARSE
        const recipesToParse = allRecipeLinks.slice(0, maxCount)

        let totalNumRecipes = recipesToParse.length

        // SET UP PROGRESS BAR FOR CLI USERS
        const progressBar = multibar ? multibar.create(totalNumRecipes, 0) : (new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic));

        progressBar.start(totalNumRecipes, 0, { title: name })

        // START: PARSE ALL SCRAPED RECIPES
        const allRecipeInfo = await recipesToParse
            .reduce(async (accumulator, url) => {

                const prevRecipeInfo = await accumulator;

                await instance.goto(url)

                const parsedRecipeInfo = await parseRecipe(instance)

                const updateObj = { title: name }

                if (!parsedRecipeInfo) {
                    progressBar.setTotal(--totalNumRecipes)
                } else progressBar.update(prevRecipeInfo.length + 1, updateObj);

                return prevRecipeInfo.concat(parsedRecipeInfo ? [parsedRecipeInfo] : [])

            }, Promise.resolve([]))
        // END: PARSE ALL SCRAPED RECIPES

        progressBar.stop()

        return { ok: true, data: allRecipeInfo, instance }
    } catch (e) {
        return { ok: false, data: null, error: e.message, instance }
    }
}
async function scrapeRecipe({
    url,
    show = false,
    devTools = false,
} = {}) {
    /*
    ERROR HANDLING START
    */
    if (!url) throw new Error('NoWebsiteEntryPointException: To scrape recipes, please provide a starting URL for the website you want to scrape recipes from.')
    /*
    ERROR HANDLING END
    */

    const instance = Nightmare({
        openDevTools: devTools,
        show,
        waitTimeout: DEFAULT_TIMEOUT,
        webPreferences: {
            images: true,
            webgl: false
        }
    })

    await instance.goto(url)

    const parsedRecipeInfo = await parseRecipe(instance)

    return { data: parsedRecipeInfo, instance }

}

async function parseRecipe(instance) {
    await handleScrollThrough(instance)

    // Wait for lazy images to finish loading
    if (await instance.exists('[data-ll-status="loading"]')) {
        await instance.wait('[data-ll-status="loaded"]')
    }

    return instance
        .evaluate(
            () => {
                /* 
                    FUNCTIONS START
                */
                const parseNumber = s => !isNaN(s) ? parseFloat(s) : ([n, d] = s.split(/\D/), d) ? (n || 1) / d : '131111121234151357'[i = s.charCodeAt() % 63 % 20] / -~'133689224444557777'[i]

                const combineBlock = (s = '', lines = 1) => s.trim().split('\n').slice(0, lines).join(' ')

                const normalizeStr = (s = '') => s.trim().toLowerCase()

                const capitalizeWords = (s = '') => s.trim().toLowerCase().split(' ').map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(' ')

                const extractImage = i => ({
                    src: i.getAttribute("nitro-lazy-src") || i.currentSrc || i.getAttribute('src')
                        || '',
                    alt: i.getAttribute('alt')
                })

                /*
                    FUNCTIONS END
                */

                const recipeName = capitalizeWords(combineBlock((
                    document.querySelector(`
                        [class*='recipe-main'] h1,
                        [class*='recipe-main'] h2,
                        [id*='recipe-main'] h1,
                        [id*='recipe-main'] h2
                    `) ||
                    document.querySelector(`
                        [id*="post-title"], 
                        [id*="recipe-name"], 
                        [class*="recipe-name"], 
                        [class*="recipe-title"], 
                        [id*="recipe"] h1, 
                        [class*="recipe"] h1, 
                        [id*="recipe"] h2, 
                        [class*="recipe"] h2, 
                        [id*="recipe-name"], 
                        [id*="recipe-title"], 
                        [class*="Name"], 
                        [itemprop*="title"]
                    `) || {}
                ).innerText))

                // If a recipe name not found, return
                if (!recipeName.length) return null

                let recipeSummary = combineBlock((
                    document.querySelector(`
                        [class*="introduction-body"],
                        [class*="summary"],
                        [class*="Summary"]
                    `) ||
                    document.querySelector(`
                        [itemprop*="description"]
                    `)
                    || {}
                ).innerText, 3)

                const recipeCourse = normalizeStr(
                    (document.querySelector(`
                        [class*="recipe-course-container"] [class*="recipe-course"]:not([class*="recipe-course-label"]):not([class*="recipe-icon"]):not([class*="recipe-course-name"]),
                        [itemprop*="category"],
                        [itemprop*="Category"]
                    `) || {}
                    ).innerText
                )

                const recipeCuisine = normalizeStr(
                    (document.querySelector(`
                        [class*="recipe-cuisine-container"] [class*="recipe-cuisine"]:not([class*="recipe-cuisine-label"]):not([class*="recipe-icon"]):not([class*="recipe-cuisine-name"]),
                        [itemprop*="cuisine"],
                        [itemprop*="Cuisine"]
                    `) || {}
                    ).innerText
                )

                /*
                    Parse Timing Start
                */

                let recipePrepTime = (
                    document.querySelector(`
                        [class*="prep_time"],
                        [itemprop*="prep"]
                    `) || {}
                ).innerText

                const recipePrepTimeUnit = (
                    document.querySelector(`
                        [class*="prep_time-unit"]
                    `) || {}
                ).innerText

                if (recipePrepTime && recipePrepTimeUnit) recipePrepTime = [recipePrepTime, recipePrepTimeUnit].join(' ')

                let recipeCookTime = (
                    document.querySelector(`
                        [class*="cook_time"], 
                        [itemprop*="cook"]
                        `) || {}
                ).innerText

                const recipeCookTimeUnit = (
                    document.querySelector(`
                        [class*="cook_time-unit"]
                    `) || {}
                ).innerText

                if (recipeCookTime && recipeCookTimeUnit) recipeCookTime = [recipeCookTime, recipeCookTimeUnit].join(' ')

                let recipeTotalTime = (
                    document.querySelector(`
                        [class*="total_time"], 
                        [itemprop*="total"]
                        `) || {}
                ).innerText

                const recipeTotalTimeUnit = (
                    document.querySelector(`
                        [class*="total_time-unit"]
                    `) || {}
                ).innerText

                if (recipeTotalTime && recipeTotalTimeUnit) recipeTotalTime = [recipeTotalTime, recipeTotalTimeUnit].join(' ')

                /*
                    Parse Timing End
                */

                const recipeServingsBlock = ((
                    document.querySelector(`
                        [class*="serving"],
                        [class*="yield"],
                        [itemprop*="yield"],
                        [itemprop*="Yield"]
                        `) || {}
                ).innerText || '');

                const recipeServingsInput = ((
                    document.querySelector(`
                        [class*="serving"] input,
                        [class*="yield"] input,
                        [itemprop*="yield"] input,
                        [itemprop*="Yield"] input
                        `) || {}
                ).value || '');

                const recipeServings = recipeServingsInput || recipeServingsBlock || ''

                let recipeServingSize = parseInt(
                    recipeServings.split(' ')
                        .map(f => f.replace(/[^\d.-]/g, ''))
                        .filter(f => f !== '')[0]
                )

                const recipeImages = Object.values(
                    document.querySelectorAll(`
                        [class*="wp-image"]:not([class*='amzn']),
                        a[rel="lightbox"] img:not([class*='amzn']),
                        .entry-content img:not([class*='amzn']),
                        div[class*='image'] img

                    `) || {})
                    .filter(i => (extractImage(i).src || "").startsWith("http"))
                    .map(i => extractImage(i))

                const recipeIngredientsContainers = document.querySelectorAll(`
                    div[class*="ingredient"],
                    div[id*="ingredient"],
                    div[class*="Ingredient"],
                    div[id*="Ingredient"],
                    ul[class*="ingredient"],
                    ul[class*="Ingredient"],
                    ul[id*="ingredient"],
                    ul[id*="Ingredient"]
                `)

                const recipeIngredients = []

                Object.values(recipeIngredientsContainers).map(ric => {

                    recipeIngredients.push(
                        ...Object.values(
                            ric.querySelectorAll(`
                                li,
                                li[class*="ingredient"],
                                li[itemprop*="ingredient"]
                            `) || {})
                            .map(ri => {

                                const original = combineBlock(normalizeStr(ri.innerText))

                                return {
                                    original
                                }

                            })
                    )
                })

                const recipeInstructionsContainer = document.querySelector(`
                    div[class*="instruction"],
                    div[id*="instruction"],
                    div[class*="Instruction"],
                    div[id*="Instruction"],
                    ol[class*="instruction"],
                    ol[class*="Instruction"],
                    ol[id*="instruction"],
                    ol[id*="Instruction"],
                    ul[class*="instruction"],
                    ul[class*="Instruction"],
                    ul[id*="instruction"],
                    ul[id*="Instruction"]
                `)

                const recipeInstructions = Object.values(
                    recipeInstructionsContainer ?
                        recipeInstructionsContainer.querySelectorAll(`
                        li,
                        li[class*="instruction"],
                        li[itemprop*="instruction"]
                    `) || {} : {})
                    .map((ri, idx) => {
                        const description = combineBlock(ri.innerText, 2)

                        const images = Object.values(
                            ri.querySelectorAll('img') || {}
                        ).map(i => extractImage(i))

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
                    timing: [
                        {
                            type: 'prep',
                            original: recipePrepTime
                        },
                        {
                            type: 'cook',
                            original: recipeCookTime
                        },
                        {
                            type: 'total',
                            original: recipeTotalTime
                        }
                    ].filter(t => t.original),
                    ingredients: recipeIngredients,
                    instructions: recipeInstructions,
                    images: recipeImages,
                    servings: {
                        original: recipeServings,
                        value: recipeServingSize
                    }
                }
            })
        .then(r => {

            if (!r) return

            if (!r.timing || !r.ingredients) return r

            return {
                ...r,
                // Transform timing strings
                timing: r.timing.map(t => ({
                    ...t,
                    value: parseDuration(t.original, 'm'),
                    unit: 'mins'
                })),
                // Transform ingredients
                ingredients: r.ingredients.map(i => {

                    const { quantity, unit, ingredient } = parseRecipeIngredient(i.original)

                    return {
                        ...i,
                        unit,
                        quantity: parseFloat(quantity),
                        ingredient,
                    }

                })
            }

        })
}

function parseRecipeIngredient(ri) {
    const iStr = ri
        .replace('.', '') //Remove .
        .replace(/\([^)]*\)/g, '') //Remove ingredient explainations wrapped in ()
        .split(' for ')[0] // Remove ingredient explainations
        .split(' ').map((f, idx) => {
            // Account for recipe ingredients that contain recipes that have two words with digits

            // For example, '36 2-inch wonton wrappers'

            // This case breaks the package 'recipe-ingredient-parser-v2'

            const charRemoved = f.replace(/[^\d.-]/g, '')

            if (idx !== 0 && charRemoved.length > 0 && !f.includes('/')) return `(${f})`

            return f

        }).join(' ')

    return iStr ? parseIngredient(iStr) : {}
}

async function handleScrollThrough(instance, startingHeight = 0) {
    let currentHeight = startingHeight;

    const totalHeight = await instance.evaluate(function () {
        return document.body.scrollHeight;
    });

    const waitStep = 50

    while (totalHeight >= currentHeight) {
        currentHeight += totalHeight * 0.1;
        await instance.scrollTo(currentHeight, 0)
            .wait(waitStep);
    }
}

const writeRecipes = (recipes, prefix) => {
    fs.writeFileSync(`${OUTPUT_PATH}/${prefix}.json`, JSON.stringify(recipes))
}

Promise.all([
    // scrapeRecipeWebsite({
    //     recipeLinkSelector: '.entry-content li a',
    //     // seeMoreRecipesSelector: 'a.next',
    //     url: 'https://nomnompaleo.com/recipeindex',
    //     maxCount: 10,
    //     multibar,
    //     show: true,
    //     devTools: true,
    //     name: "Nom Nom Paleo"
    // }).then(
    //     ({ data, instance }) => {
    //         writeRecipes(data, "nn_index")

    //         return instance.end()
    //     }
    // ),
    // scrapeRecipeWebsite({
    //     recipeLinkSelector: 'a.more-link',
    //     seeMoreRecipesSelector: 'li.pagination-next a',
    //     url: 'http://www.happybellyfoodie.com/category/recipes/side-dishes/',
    //     maxCount: 10,
    //     multibar,
    //     show: true,
    //     devTools: true,
    //     name: "Happy Belly Foodie"
    // }).then(
    //     ({ data, instance }) => {
    //         writeRecipes(data, "hbf_index")

    //         return instance.end()
    //     }
    // ),
    scrapeRecipeWebsite({
        recipeLinkSelector: '.grid-card-image-container a',
        // seeMoreRecipesSelector: 'a.next',
        url: 'https://www.allrecipes.com/',
        maxCount: `1`,
        multibar,
        show: true,
        devTools: true,
        name: "AllRecipes"
    }).then(
        ({ ok, error, data, instance }) => {
            if (ok) writeRecipes(data, "ac_index")
            else console.log(error)

            // return instance.end()
        }
    ),

    // scrapeRecipe({
    //     url: 'https://minimalistbaker.com/raw-rainbow-peanut-noodle-salad/',
    //     show: true,
    //     devTools: true,
    // }).then(
    //     ({ data, instance }) => {
    //         if (data) writeRecipes(data, data.name.split(' ').join('-'))

    //         return instance.end()
    //     }
    // )


]).then(() => multibar.stop())

// WPURP
// https://hispanickitchen.com/?s=
