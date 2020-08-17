const Nightmare = require('nightmare')
const cliProgress = require('cli-progress');
const moment = require('moment')
const parseDuration = require('parse-duration')
const { parse: parseIngredient } = require('recipe-ingredient-parser-v2');



const fs = require('fs')

const OUTPUT_PATH = 'generated'

const multibar = new cliProgress.MultiBar({
    format: '{title} |' + '{bar}' + '| {percentage}% || {value}/{total} Recipes',
    hideCursor: true

}, cliProgress.Presets.shades_grey);

async function scrapeRecipeWebsite({
    maxCount = 1,
    name = "Recipes",
    url,
    show = false,
    devTools = false,
    multibar = null,
    categoryLinkSelector,
    recipeLinkSelector,
    seeMoreRecipesSelector,
} = {}) {
    /*
    ERROR HANDLING START
    */
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

    /*
    ERROR HANDLING END
    */

    const instance = Nightmare({
        openDevTools: devTools,
        show,
        webPreferences: {
            images: false,
            webgl: false
        }
    })

    // SCRAPE STARTING URL FOR RECIPE CATEGORY PAGES
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

    // SCRAPE RECIPE LINKS FROM SCRAPED RECIPE CATEGORY PAGES
    const allRecipeLinks = await recipeListPages
        .reduce(async (accumulator, url) => {

            const prevRecipeLinks = await accumulator;

            if (prevRecipeLinks.length >= maxCount) return prevRecipeLinks

            const remaining = maxCount - prevRecipeLinks.length

            const parsedRecipeLinks = []

            let currentUrl = url;

            while (parsedRecipeLinks.length <= remaining) {

                const { data, next } = await instance.goto(currentUrl)
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

                        while (seeMoreRecipesSelector && recipePages.length <= remaining) {
                            const seeMoreButton = document.querySelector(seeMoreRecipesSelector)

                            if (seeMoreButton) {
                                const nextPageLink = seeMoreButton.getAttribute('href')

                                // If the see more button does not travel to a new page, click to load more recipes
                                if (
                                    !nextPageLink ||
                                    !nextPageLink.includes('http')
                                ) seeMoreButton.click()

                                // Otherwise, handle traveling to the new page
                                else if (nextPageLink.includes('http')) {
                                    return {
                                        data: recipePages,
                                        next: nextPageLink
                                    }
                                }

                            }

                            else break

                            recipePages.push(
                                ...findRecipeLinks()
                            );

                        }

                        return { data: recipePages, next: null }

                    }, remaining, recipeLinkSelector, seeMoreRecipesSelector)

                parsedRecipeLinks.push(...data)

                if (next) currentUrl = next
                else break;


            }

            return prevRecipeLinks.concat(parsedRecipeLinks)

        }, Promise.resolve([]))

    // REDUCE NUMBER OF RECIPES TO PARSE
    const recipesToParse = allRecipeLinks.slice(0, maxCount)

    let totalNumRecipes = recipesToParse.length

    // SET UP PROGRESS BAR FOR CLI USERS
    const progressBar = multibar ? multibar.create(totalNumRecipes, 0) : (new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic));

    progressBar.start(totalNumRecipes, 0)

    const allRecipeInfo = await recipesToParse
        .reduce(async (accumulator, url) => {

            const prevRecipeInfo = await accumulator;

            await instance.goto(url)

            const parsedRecipeInfo = await parseRecipe(instance)

            const updateObj = { title: name }

            if (!parsedRecipeInfo) progressBar.setTotal(--totalNumRecipes)

            progressBar.update(prevRecipeInfo.length + 1, updateObj);

            return prevRecipeInfo.concat(parsedRecipeInfo ? [parsedRecipeInfo] : [])

        }, Promise.resolve([]))

    progressBar.stop()

    return { data: allRecipeInfo, instance }

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
        webPreferences: {
            images: false,
            webgl: false
        }
    })

    await instance.goto(url)

    const parsedRecipeInfo = await parseRecipe(instance)

    return { data: parsedRecipeInfo, instance }

}

async function parseRecipe(instance) {
    await handleScrollThrough(instance)

    return instance
        .evaluate(
            () => {
                /* 
                    FUNCTIONS START
                */
                const parseNumber = s => !isNaN(s) ? parseFloat(s) : ([n, d] = s.split(/\D/), d) ? (n || 1) / d : '131111121234151357'[i = s.charCodeAt() % 63 % 20] / -~'133689224444557777'[i]

                const combineBlock = (s = '', lines = 1) => s.trim().split('\n').slice(0, lines).join(' ')

                const normalizeStr = (s = '') => s.trim().toLowerCase()

                const extractImage = i => ({
                    src: i.getAttribute("nitro-lazy-src") || i.getAttribute('src')
                        || '',
                    alt: i.getAttribute('alt')
                })

                /*
                    FUNCTIONS END
                */

                const recipeName = combineBlock((
                    document.querySelector(`
                        [id*="post-title"], 
                        [id*="recipe-name"], 
                        [class*="recipe-name"], 
                        [class*="recipe-title"], 
                        [id*="recipe-name"], 
                        [id*="recipe-title"], 
                        [class*="Name"], 
                        [itemprop*="title"]
                    `) || {}
                ).innerText)

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

                const recipeServings = ((
                    document.querySelector(`
                        [class*="serving"],
                        [class*="yield"],
                        [itemprop*="yield"],
                        [itemprop*="Yield"]
                        `) || {}
                ).innerText || '');

                let recipeServingSize = parseInt(recipeServings.replace(/[^\d.-]/g, '').split(' ')[0])

                const recipeImages = Object.values(
                    document.querySelectorAll(`
                        [class*="wp-image"],
                        a[rel="lightbox"] img
                    `) || {})
                    .filter(i => {
                        return (extractImage(i).src || "").includes("http")
                    }
                    )
                    .map(i => extractImage(i))

                const recipeIngredients = Object.values(

                    document.querySelectorAll(`
                        div[class*="ingredient"] li,
                        div[id*="ingredient"] li,
                        div[class*="Ingredient"] li,
                        div[id*="Ingredient"] li,
                        ol li[class*="ingredient"],
                        ol li[itemprop*="ingredient"],
                        ol[class*="ingredient"] li,
                        ol[class*="Ingredient"] li,
                        ol[id*="ingredient"] li,
                        ol[id*="Ingredient"] li
                    `) || {})
                    .map(ri => {

                        const original = combineBlock(normalizeStr(ri.innerText))

                        return {
                            original
                        }

                    })

                const recipeInstructionsContainer = document.querySelector(`
                    div[class*="instruction"],
                    div[id*="instruction"],
                    div[class*="Instruction"],
                    div[id*="Instruction"],
                    ol[class*="instruction"],
                    ol[class*="Instruction"],
                    ol[id*="instruction"],
                    ol[id*="Instruction"]
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
                        transform: recipeServingSize
                    }
                }
            })
        .then(r => {

            if (!r.timing) return r

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

                    const parsedIngredient = parseIngredient(i.original
                        .replace('.', '') //Remove .
                        .replace(/\([^)]*\)/g, '') //Remove ingredient explainations wrapped in ()
                        .split(',')[0] // Remove ingredient explainations
                        .split(' for ')[0] // Remove ingredient explainations
                        || '')

                    const { quantity, unit, ingredient } = parsedIngredient

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

async function handleScrollThrough(instance) {
    let currentHeight = 0;

    const totalHeight = await instance.evaluate(function () {
        return document.body.scrollHeight;
    });

    const waitStep = 100

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
    //     recipeLinkSelector: '.archive-post a',
    //     seeMoreRecipesSelector: 'a.next',
    //     url: 'https://damndelicious.net/category/asian-inspired/',
    //     maxCount: 1,
    //     multibar,
    //     show: true,
    //     devTools: true,
    //     name: "Damn Delicious"
    // }).then(
    //     ({ data, instance }) => {
    //         writeRecipes(data, "woks_index")

    //         // return instance.end()
    //     }
    // ),
    scrapeRecipe({
        url: 'https://damndelicious.net/2018/09/18/peanut-chicken-lettuce-wraps/',
        show: true,
        devTools: true,
    }).then(
        ({ data, instance }) => {
            writeRecipes(data, data.name)

            return instance.end()
        }
    ),

]).then(() => multibar.stop())

// WPURP
// https://hispanickitchen.com/?s=
