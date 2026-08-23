# DBD Lite Prompt Protocol

DBD Lite uses temporary JSON Session packets, not persistent Question Banks.

The built-in **COPY PROMPT** instruction asks the subject chatbot to:

1. inspect the actual subject-chat files and recent learning context;
2. ask one compact setup question;
3. think and audit before writing questions;
4. create a compatible DBD Lite JSON Session packet;
5. use a downloadable `.json` file for large packets;
6. never output full-DBD Bank/scheduler/maintenance architecture unless explicitly requested outside Lite.

The app itself automatically downloads an overlong generated prompt as Markdown (`.md`) instead of forcing an oversized clipboard payload.
