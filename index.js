const Nightmare = require('nightmare')
const cliProgress = require('cli-progress');
const moment = require('moment')

const fs = require('fs')

const OUTPUT_PATH = 'generated'

const WP_TYPE = "WP"

const ZL_TYPE = "ZL"

const ERS_TYPE = "ERS"


const RECIPE_TYPES = [
    WP_TYPE,
    ZL_TYPE,
    ERS_TYPE
]

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
        show
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

            // Determine type of recipe structure

            const recipeType = await instance.goto(url)
                .evaluate((WP_TYPE, ZL_TYPE, ERS_TYPE) => {
                    const wpRecipeName = (document.querySelector('[class*="wprm-recipe-name"]') || {}).innerText

                    const zlRecipeName = (document.querySelector('[id*="zlrecipe-title"]') || {}).innerText

                    const ersRecipeName = (document.querySelector('[class*="ERSName"]') || {}).innerText

                    if (wpRecipeName) return WP_TYPE

                    if (zlRecipeName) return ZL_TYPE

                    if (ersRecipeName) return ERS_TYPE

                    return null

                }, ...RECIPE_TYPES)


            let parseRecipe

            switch (recipeType) {
                case WP_TYPE:
                    parseRecipe = parseWordPressRecipe
                    break
                case ZL_TYPE:
                    parseRecipe = parseZLRecipe
                    break
                case ERS_TYPE:
                    parseRecipe = parseERSRecipe
                    break
                default:
                    parseRecipe = () => null
                    break
            }

            const parsedRecipeInfo = await parseRecipe(instance)

            const updateObj = { title: name }

            if (!parsedRecipeInfo) progressBar.setTotal(--totalNumRecipes)

            progressBar.update(prevRecipeInfo.length + 1, updateObj);

            return prevRecipeInfo.concat(parsedRecipeInfo ? [parsedRecipeInfo] : [])

        }, Promise.resolve([]))

    progressBar.stop()

    return { data: allRecipeInfo, instance }

}

// TESTED FOR
// https://norecipes.com/
// https://www.justonecookbook.com/
// https://thewoksoflife.com/recipe-list/
// https://www.kawalingpinoy.com/category/recipe-index/
// https://www.chinasichuanfood.com/?s=
async function parseWordPressRecipe(instance) {
    let currentHeight = 0;

    /*
        SCROLL THROUGH START
    */
    const totalHeight = await instance.evaluate(function () {
        return document.body.scrollHeight;
    });

    const waitStep = 100

    while (totalHeight >= currentHeight) {
        currentHeight += totalHeight * 0.1;

        await instance.scrollTo(currentHeight, 0)
            .wait(waitStep);
    }
    /*
        SCROLL THROUGH END
    */

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

                const recipeCourse = normalizeStr((document.querySelector('[class*="recipe-course-container"] [class*="recipe-course"]:not([class*="recipe-course-label"]):not([class*="recipe-icon"]):not([class*="recipe-course-name"])') || {}).innerText)

                const recipeCuisine = normalizeStr((document.querySelector('[class*="recipe-cuisine-container"] [class*="recipe-cuisine"]:not([class*="recipe-cuisine-label"]):not([class*="recipe-icon"]):not([class*="recipe-cuisine-name"])') || {}).innerText)

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
                        return (extractImage(i).src || "").includes("http")
                    }
                    )
                    .map(i => extractImage(i))

                const recipeIngredients = Object.values(
                    document.querySelectorAll('li[class*="recipe-ingredient"]') || {})
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
                    timing: (recipePrepTime || recipeCookTime || recipeTotalTime) ? {
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
                    } : null,
                    ingredients: recipeIngredients,
                    instructions: recipeInstructions,
                    images: recipeImages,
                    servings: parseInt(recipeServingSize)
                }
            })
}

// TESTED FOR
// https://www.japanesecooking101.com/?s=
// https://ladyandpups.com/?s=
async function parseZLRecipe(instance) {

    let currentHeight = 0;

    /*
        SCROLL THROUGH START
    */
    const totalHeight = await instance.evaluate(function () {
        return document.body.scrollHeight;
    });

    const waitStep = 100

    while (totalHeight >= currentHeight) {
        currentHeight += totalHeight * 0.1;

        await instance.scrollTo(currentHeight, 0)
            .wait(waitStep);
    }
    /*
        SCROLL THROUGH END
    */

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

                const recipeName = (document.querySelector('[id*="recipe-title"]') || {}).innerText

                // If a recipe name not found, return
                if (!recipeName) return null

                const recipeSummary = (document.querySelector('[class*="recipe-summary"]') || {}).innerText || ''

                // NOT FOUND IN ZL RECIPES
                const recipeCourse = ''

                // NOT FOUND IN ZL RECIPES
                const recipeCuisine = ''

                /*
                PARSE RECIPE TIME START
                */
                const recipePrepTimeISOContainer = document.querySelector('[itemprop="prepTime"]')

                const recipePrepTime = recipePrepTimeISOContainer ? recipePrepTimeISOContainer.getAttribute('content') : null

                const recipeCookTimeISOContainer = document.querySelector('[itemprop="cookTime"]')

                const recipeCookTime = recipeCookTimeISOContainer ? recipeCookTimeISOContainer.getAttribute('content') : null

                /*
                PARSE RECIPE TIME END
                */

                const recipeServings = (document.querySelector('[class*="zlrecipe-serving-size"]') || document.querySelector('[class*="zlrecipe-yield"]') || {}).innerText

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
                        return (extractImage(i).src || "").includes("http")
                    }
                    )
                    .map(i => extractImage(i))

                const recipeIngredients = Object.values(
                    document.querySelectorAll('ul[id*="recipe-ingredients-list"] li.ingredient') || {})
                    .map(ri => {

                        // WIP : No separation of quantity, unit, and name
                        const name = normalizeStr(ri.innerText)

                        return {
                            name
                        }

                    })


                const recipeInstructions = Object.values(
                    document.querySelectorAll('ol[id*="recipe-instructions-list"]') || {})
                    .map((ri, idx) => {
                        const description = (ri.querySelector('li.instruction') || {}).innerText

                        return {
                            step: idx + 1,
                            description,
                            images: []
                        }

                    })

                return {
                    link: document.URL,
                    name: recipeName,
                    summary: recipeSummary,
                    course: recipeCourse,
                    cuisine: recipeCuisine,
                    timing: {
                        prep: recipePrepTime,
                        cook: recipeCookTime,
                    },
                    ingredients: recipeIngredients,
                    instructions: recipeInstructions,
                    images: recipeImages,
                    servings: parseInt(recipeServingSize)
                }
            })
        .then(r => {


            if (r) {
                const {
                    timing: {
                        prep: recipePrepTimeISO,
                        cook: recipeCookTimeISO
                    }
                } = r

                const unit = "mins"


                const recipeCookTime = recipeCookTimeISO ? moment.duration(recipeCookTimeISO).asMinutes() : null

                const recipePrepTime = recipePrepTimeISO ? moment.duration(recipePrepTimeISO).asMinutes() : null

                const recipeTotalTime = (recipePrepTime || recipeCookTime) ? (recipePrepTime || 0) + (recipeCookTime || 0) : null

                return {
                    ...r,
                    timing: (recipePrepTime || recipeCookTime || recipeTotalTime) ? {
                        prep: recipePrepTime ? {
                            value: recipePrepTime,
                            unit
                        } : {},
                        cook: recipeCookTime ? {
                            value: recipeCookTime,
                            unit
                        } : {},
                        total: recipeTotalTime ? {
                            value: recipeTotalTime,
                            unit
                        } : {},
                    } : null,
                }
            }

            return r
        })
}
// TESTED FOR
// http://www.itsmydish.com/?s=
async function parseERSRecipe(instance) {

    let currentHeight = 0;

    /*
        SCROLL THROUGH START
    */
    const totalHeight = await instance.evaluate(function () {
        return document.body.scrollHeight;
    });

    const waitStep = 100

    while (totalHeight >= currentHeight) {
        currentHeight += totalHeight * 0.1;

        await instance.scrollTo(currentHeight, 0)
            .wait(waitStep);
    }
    /*
        SCROLL THROUGH END
    */

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

                const recipeName = (document.querySelector('[class*="ERSName"]') || {}).innerText

                // If a recipe name not found, return
                if (!recipeName) return null

                const recipeSummary = (document.querySelector('[class*="ERSSummary"]') || {}).innerText || ''

                const recipeCourse = (document.querySelector('[itemprop="recipeCategory"]') || {}).innerText

                const recipeCuisine = (document.querySelector('[itemprop="recipeCuisine"]') || {}).innerText

                /*
                PARSE RECIPE TIME START
                */
                const recipePrepTimeISOContainer = document.querySelector('[itemprop="prepTime"]')

                const recipePrepTime = recipePrepTimeISOContainer ? recipePrepTimeISOContainer.getAttribute('datetime') : null

                const recipeCookTimeISOContainer = document.querySelector('[itemprop="cookTime"]')

                const recipeCookTime = recipeCookTimeISOContainer ? recipeCookTimeISOContainer.getAttribute('datetime') : null

                /*
                PARSE RECIPE TIME END
                */

                const recipeServings = (document.querySelector('[itemprop="recipeYield"]') || {}).innerText

                let recipeServingSize

                if (recipeServings) {
                    let tmp = recipeServings.split(" ")[1]

                    if (!tmp) return

                    tmp = tmp.trim()

                    recipeServingSize = tmp.split(" ")[0]

                }

                const recipeImages = Object.values({
                    ...(document.querySelectorAll('[class*="wp-image"]') || {}),
                    ...(document.querySelectorAll('a[rel="lightbox"] img') || {})
                }
                )
                    .filter(i => {
                        return (extractImage(i).src || "").includes("http")
                    }
                    )
                    .map(i => extractImage(i))

                console.log(recipeImages)

                const recipeIngredients = Object.values(
                    document.querySelectorAll('.ERSIngredients li.ingredient') || {})
                    .map(ri => {

                        // WIP : No separation of quantity, unit, and name
                        const name = normalizeStr(ri.innerText)

                        return {
                            name
                        }

                    })


                const recipeInstructions = Object.values(
                    document.querySelectorAll('.ERSInstructions li.instruction') || {})
                    .map((ri, idx) => {
                        const description = ri.innerText

                        return {
                            step: idx + 1,
                            description,
                            images: []
                        }

                    })

                return {
                    link: document.URL,
                    name: recipeName,
                    summary: recipeSummary,
                    course: recipeCourse,
                    cuisine: recipeCuisine,
                    timing: {
                        prep: recipePrepTime,
                        cook: recipeCookTime,
                    },
                    ingredients: recipeIngredients,
                    instructions: recipeInstructions,
                    images: recipeImages,
                    servings: parseInt(recipeServingSize)
                }
            })
        .then(r => {


            if (r) {
                const {
                    timing: {
                        prep: recipePrepTimeISO,
                        cook: recipeCookTimeISO
                    }
                } = r

                const unit = "mins"


                const recipeCookTime = recipeCookTimeISO ? moment.duration(recipeCookTimeISO).asMinutes() : null

                const recipePrepTime = recipePrepTimeISO ? moment.duration(recipePrepTimeISO).asMinutes() : null

                const recipeTotalTime = (recipePrepTime || recipeCookTime) ? (recipePrepTime || 0) + (recipeCookTime || 0) : null

                return {
                    ...r,
                    timing: (recipePrepTime || recipeCookTime || recipeTotalTime) ? {
                        prep: recipePrepTime ? {
                            value: recipePrepTime,
                            unit
                        } : {},
                        cook: recipeCookTime ? {
                            value: recipeCookTime,
                            unit
                        } : {},
                        total: recipeTotalTime ? {
                            value: recipeTotalTime,
                            unit
                        } : {},
                    } : null,
                }
            }

            return r
        })
}

const writeRecipes = (recipes, prefix) => {
    fs.writeFileSync(`${OUTPUT_PATH}/${prefix}.json`, JSON.stringify(recipes))
}

Promise.all([
    scrapeRecipeWebsite({
        recipeLinkSelector: '.title a',
        seeMoreRecipesSelector: '.nav-entries a',
        url: 'https://shesimmers.com/?s=',
        maxCount: 15,
        multibar,
        show: true,
        devTools: true,
        name: "She Simmers"
    }).then(
        ({ data, instance }) => {
            writeRecipes(data, "she_simmers_index")

            return instance.end()
        }
    ),

]).then(() => multibar.stop())

// ERS
// https://shesimmers.com/?s=
// http://www.itsmydish.com/?s=

// WPURP
// https://hispanickitchen.com/?s=
