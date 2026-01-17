# Contributing to Yoto F1 Card Generator

First off, thank you for considering contributing to the Yoto F1 Card Generator! It's people like you that make this project better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Describe the behavior you observed and what you expected**
- **Include screenshots if possible**
- **Include your environment details** (OS, Node version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed feature**
- **Explain why this enhancement would be useful**
- **List any alternative solutions you've considered**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure your code follows the existing style
4. Make sure your code lints (`npm run lint`)
5. Write a clear commit message
6. Open a pull request!

## Development Process

### Setting Up Your Environment

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/yoto-f1-card-generator/yoto-f1-card.git
   cd yoto-f1-card
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your Yoto credentials
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

### Coding Standards

- Use meaningful variable and function names
- Write comments for complex logic
- Follow the existing code style
- Keep functions small and focused
- Use async/await instead of promises where possible

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:

```
Add auto-update feature for existing cards

- Store card ID in configstore after creation
- Check for existing card ID before creating new
- Update UI to show update status
- Add badge for updated cards

Fixes #123
```

### Branch Naming

- `feature/description` - For new features
- `fix/description` - For bug fixes
- `docs/description` - For documentation changes
- `refactor/description` - For code refactoring

## Project Structure

```
yoto-app/
├── src/
│   ├── app/                 # Next.js app router pages
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # Authentication endpoints
│   │   │   └── generate-card/  # Card generation endpoint
│   │   ├── layout.js       # Root layout
│   │   ├── page.js         # Home page
│   │   └── globals.css     # Global styles
│   └── services/           # Business logic
│       ├── f1Service.js    # F1 API integration
│       └── yotoService.js  # Yoto API integration
├── .env.example            # Environment template
├── README.md               # Main documentation
└── package.json            # Dependencies
```

## Adding New Features

### Adding a New Data Source

1. Create a new service file in `src/services/`
2. Export functions to fetch data
3. Handle errors gracefully
4. Add mock data fallbacks

Example:

```javascript
// src/services/newService.js
export async function fetchData() {
  try {
    const response = await fetch("...");
    return await response.json();
  } catch (error) {
    console.log("Using mock data:", error.message);
    return MOCK_DATA;
  }
}
```

### Adding a New Chapter

1. Update `buildF1Chapters()` in `src/services/yotoService.js`
2. Add the chapter structure with text content
3. Test the TTS output

### Adding New API Endpoints

1. Create a new route in `src/app/api/`
2. Follow the existing authentication pattern
3. Add error handling
4. Document the endpoint in README

## Testing

Before submitting a PR:

1. Test the OAuth flow
2. Test card creation
3. Test card updates
4. Test error scenarios
5. Test on different browsers if UI changes

## Questions?

Feel free to:

- Open an issue for discussion
- Join the [Yoto Discord](https://discord.gg/FkwBpYf2CN)
- Check existing issues and PRs

## Recognition

Contributors will be recognized in:

- The project README
- Release notes
- GitHub contributors page

Thank you for contributing! 🎉
