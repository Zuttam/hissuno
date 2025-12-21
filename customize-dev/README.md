## About the project 
Title: Customize AI 
Subtitle: End-User influenced software 

## Brief 
he purpose of this prohject is to create a support agent for small saas platforms that is also connects to the project source code and is able to create change requests (future: PRs in github) based on end user inquires alongside answering questions. it will also be able to answer technical question as it is connected and understands the code.  

components included in the  solution : 
1. Widget that the developer can integrate into their platform and opens a chat agent - use copilot kit https://docs.copilotkit.ai/  
2. the agent interface should interact with an agent (in mastra) that will provide guided support for users 
3. the agent will gather information on issues that the user might have or change requests. 
4. the agent will be equiped with "product manager" mindset -> will ask guiding questions to gather the relevnt informtion before it setup to create a product spec and pull request
5. eventually (once all data is present) the agent will start a workflow where it prepares a feature request spec which the developer can approve (in customize dashboard) 
6. Developer dashboard where they can setup their projects, connect their source code and knowledge that the agent will use and be equipped with 