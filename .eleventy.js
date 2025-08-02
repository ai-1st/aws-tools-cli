export default function(eleventyConfig) {
    eleventyConfig.addTransform("mdLinksToHtml", function (content, outputPath) {
        if (outputPath && outputPath.endsWith(".html")) {
            return content.replace(/href="([^"]+)\.md"/g, 'href="$1.html"');
        }
        return content;
    });
    eleventyConfig.addGlobalData("eleventyComputed", {
        permalink: data => {
            // Include the directory path to avoid conflicts
            const inputPath = data.page.inputPath;
            const pathParts = inputPath.split('/');
            const dir = pathParts[pathParts.length - 2]; // Get the parent directory
            const fileName = data.page.fileSlug;
            return `${dir}/${fileName}.html`;
        }
    });
    eleventyConfig.setUseGitIgnore(false);
    eleventyConfig.ignores.add("**/*.html");
    eleventyConfig.addGlobalData('layout', 'base.njk'); 
    return {
        dir: { 
            input: 'output/', 
            output: 'output/', 
            includes: '../eleventy/includes' 
        }
    };
}