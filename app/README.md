# Important Note

This folder is used for electron as this package.json is used in the distribution of the application to limit the dependencies used in the final build.

Any dependency used directly in electron's **main** process or the **renderer worker** must be added to the package.json file.
