const Nightmare = require('nightmare')
const nightmare = Nightmare({
    openDevTools: true,
    show: true
})
const fs = require('fs')
 
// TESTED ONLY WITH https://www.justonecookbook.com/
async function scrape() {
    
    const recipePages = []
    
    const maxPageNumber = await nightmare
    .goto('https://www.justonecookbook.com/recipes')
    .evaluate(() => {
        const matches = document.querySelectorAll('a.page-numbers:not(.next)')
        
        const pageButtons = Object.keys(matches).map(k => matches[k].text)
        
        return parseInt(pageButtons.pop())
    })

    for (let i = 1; i <= 1; i++) {
        recipePages.push(`https://www.justonecookbook.com/recipes${i !== 1 ? `/page/${i}` :''}`)
    }
    
    const allRecipeLinks = await recipePages
        .reduce(async (accumulator, url) => {
            
            const prevRecipeLinks = await accumulator;

            const parsedRecipeLinks = await nightmare.goto(url)
                    .evaluate(() => {
                        const matches = document.querySelectorAll('.grid.thumb a[rel="bookmark"]')
                        
                        return Object.keys(matches).map(k => matches[k].href)
                        
                    })
            
            return prevRecipeLinks.concat(parsedRecipeLinks)

        }, Promise.resolve([]))

    const allRecipeInfo = await allRecipeLinks
        .reduce(async (accumulator, url) => {
            
            const prevRecipeInfo = await accumulator;
            
            const parsedRecipeInfo = await parseRecipe(url)
                
            return prevRecipeInfo.concat(parsedRecipeInfo ? [parsedRecipeInfo] : [])

        }, Promise.resolve([]))
        
        fs.writeFileSync("generated/recipes.json", JSON.stringify(allRecipeInfo))
            
        return nightmare.end()
    
        // https://stackoverflow.com/questions/40832949/how-to-end-nightmarejs-instance-after-chaining-promises
}

// scrape()
    
async function parseRecipe(url) {
     return await nightmare.goto(url)
            .evaluate(() => {
                const recipeName = (document.querySelector('[class*="recipe-name"]') || {}).innerText
        
                // If a recipe name not found, return
                if(!recipeName) return null

                const recipeSummary = (document.querySelector('[class*="recipe-summary"]') || {}).innerText
                
                const recipeCourse = (document.querySelector('[class$="recipe-course"]') || {}).innerText
        
                const recipeCuisine = (document.querySelector('[class$="recipe-cuisine"]') || {}).innerText
        
                const recipePrepTime = (document.querySelector('[class*="prep_time"]') || {}).innerText

                const recipeCookTime = (document.querySelector('[class*="cook_time"]') || {}).innerText

                const recipeTotalTime = (document.querySelector('[class*="total_time"]') || {}).innerText

                const recipeServingSize = (document.querySelector('[class*="recipe-servings-link"]') || {}).innerText


                console.log(document.querySelector('[class*="recipe-servings-link"]'))
                const recipeServingUnit = (document.querySelector('[class$="recipe-servings-unit"]') || {}).innerText

                const recipeImages = Object.values(
                    document.querySelectorAll('[class*="wp-image"]') || {})
                    .filter(i => 
                        (i.getAttribute("nitro-lazy-src") || "").includes("https")
                    )
                    .map(i => (
                        {
                        src: i.getAttribute("nitro-lazy-src"),
                        alt: i.getAttribute("alt")
                        }
                    ))
                
                const recipeIngredients = Object.values(
                    document.querySelectorAll('[class$="recipe-ingredient"]') || {})
                    .map(ri => {
                        const amount = parseInt(
                            (ri.querySelector('[class*=recipe-ingredient-amount]') || {}).innerText
                        )

                        const unit = (ri.querySelector('[class*=recipe-ingredient-unit]') || {}).innerText
                        

                        const name = ((ri.querySelector('[class*=recipe-ingredient-name]') || {}).innerText || '').replace(/\([^)]*\)/g,'')

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
                            .map(i => ({
                                src: i.getAttribute('nitro-lazy-src'),
                                alt: i.getAttribute('alt')
                            }))
                        
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
                            prep: parseInt(recipePrepTime),
                            cook: parseInt(recipeCookTime),
                            total: parseInt(recipeTotalTime),
                        },
                        ingredients: recipeIngredients,
                        instructions: recipeInstructions,
                        images: recipeImages,
                        servings: {
                            quantity: recipeServingSize,
                            unit: recipeServingUnit
                        }
                    }
                
                    
                })
} 

parseRecipe("https://www.justonecookbook.com/ume-plum-compote/").then(
    r => {

        fs.writeFileSync(`generated/${r.name.toLowerCase().split(" ").join("-")}.json`, JSON.stringify(r))

        return nightmare.end()
    }
)