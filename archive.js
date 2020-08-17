const Nightmare = require('nightmare')
const cliProgress = require('cli-progress');

const WP_TYPE = "WP"

const ZL_TYPE = "ZL"

const ERS_TYPE = "ERS"


const RECIPE_TYPES = [
    WP_TYPE,
    ZL_TYPE,
    ERS_TYPE
]

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
// https://www.kawalingpinoy.com/category/recipe-index/
// https://www.chinasichuanfood.com/?s=
async function parseWordPressRecipe(instance) {
    await handleScrollThrough(instance)

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

    await handleScrollThrough(instance)

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
// https://shesimmers.com/?s=
// http://www.itsmydish.com/?s=
async function parseERSRecipe(instance) {

    await handleScrollThrough(instance)

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