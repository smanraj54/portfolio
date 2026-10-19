**MANRAJ SINGH**  
***Portfolio: [manrajsingh.ca](https://manrajsingh.ca/)***  
*Permanent Resident \- **Canada***  
1105 \- 13350 Central Ave Surrey, BC, V3T 0S1  
**![Receiver with solid fill][image1](902) 412-9128  ![][image2][manrajsingh.ca](https://manrajsingh.ca/)  ![Envelope with solid fill][image3][smanraj54@gmail.com](mailto:smanraj54@gmail.com)  ![][image4][LinkedIn Profile-smanraj54](https://www.linkedin.com/in/smanraj54/)  ![][image5][GitHub-smanraj54](https://github.com/smanraj54)**

**PROFILE** 

Senior Software Engineer with 7.2 years building backend and distributed systems, including 3.5 years at Amazon. Recent work spans cloud application architecture on AWS, realtime protocol design over WebSockets and gRPC, and retrieval augmented generation over large numbers of documents. Comfortable owning a service end to end, from API design through deployment, and cutting latency on systems already in production.

**CORE COMPETENCIES** 

* Languages: Java (Advanced), TypeScript, Python, Node.js, Kotlin, C++  
* Backend: Spring Boot, Node.js, gRPC, WebSockets, REST APIs, Microservices	  
* Frontend: React, Angular, Redux, TypeScript, Electron, HTML/CSS  
* Databases: PostgreSQL, MySQL, MongoDB, DynamoDB, OpenSearch  
* Cloud (AWS): EKS, ECS, Lambda, EC2, S3, EFS, ECR, RDS, DynamoDB, API Gateway,CloudFront, Bedrock, WAF, CloudFormation, CDK  
* DevOps & CI/CD: Docker, GitHub Actions, Cypress, Maven  
* AI/ML: Retrieval Augmented Generation, Vector Search, Embeddings, Amazon Bedrock, MCP servers.  
* Architectures: Distributed Systems, Microservices, Cloud Native, Event Driven  
* Performance: Latency Reduction, High Throughput API Design

**WORK EXPERIENCE**

**Senior Software Engineer**  
*Ansys (Acquired by Synopsys), Canada*	         	                 			              September 2025 – Current

* **Ticket Assist \- RAG Assistant for Support Tickets**  
  * Built a RAG assistant that drafts replies to support tickets (1,000-2,000 a day) from internal runbooks, past tickets, and product manuals. Launched for two teams, cutting low priority turnaround from \~7 days to 3\.  
  * **Ingestion pipeline:** documents are added through pull requests, and GitHub Actions uploads changed files to S3. An S3 event starts a Step Functions workflow through EventBridge, where Lambdas convert PDF manuals to Markdown, split them into chunks, embed everything with Amazon Titan, and index it in OpenSearch.  
  * **Triage pipeline:** a Jira label triggers a webhook to API Gateway, which starts a Step Functions workflow. Lambdas fetch the ticket, run hybrid keyword and vector search in OpenSearch, draft a reply with source links using Claude on Amazon Bedrock, and post it as an internal Jira comment for agent review.  
  * Used DynamoDB so a ticket is never answered twice, measured retrieval with Recall@5 and Recall@10, and defined all infrastructure in AWS CDK.  
  * **Tech Stack:** TypeScript, Java, Python, Amazon Bedrock (Claude, Titan Embeddings), OpenSearch, AWS (Lambda, Step Functions, API Gateway, EventBridge, S3, DynamoDB), CDK, GitHub Actions, Jira

* **Concept SI \- Web Platform for 3D Circuit Board Simulation**  
  * Moved a Windows only desktop tool to the web. The simulation engines already existed as native services. I built a layer that lets a browser drive them.  
  * Designed a WebSocket protocol carrying approx 30 operations, translated to gRPC on the backend. Requests are matched by ID so many can run at once over one connection.  
  * Design files run past 500 MB, so services never send them to each other. Files land once on a shared EFS volume and every service reads from the same path.  
  * Gave each user their own copy of a file, keyed by their SSO identity. Two people can open the same design without conflicting, so no locking was needed.  
  * Secured every backend call with SSO token verification, plus guards against SSRF, path traversal, and NoSQL injection.  
  * Packaged every service as a container image and deployed the stack to a managed cluster on AWS, with per environment configuration so cloud and on prem installs run from the same images. Builds publish through GitHub Actions on merge.  
  * Packaged the same stack as an Electron desktop app so customers who can't put data in the cloud run everything locally. Only the configuration changes.  
  * **Tech Stack:** Node.js, TypeScript, gRPC, WebSockets, Angular, MongoDB, Docker, AWS (EKS, ECR, EFS, S3, CloudFront), GitHub Actions


**Software Development Engineer**  
*Amazon, Canada*		         			                 			     May 2022 – September 2025

* **Explore Brand Selection \- Selection Gap Discovery for Brand Owners**  
  * Built a Seller Central and Vendor Central tool that finds a brand’s products missing from Amazon, or listed there only by other sellers, and prefills their listings. The brand then adds only missing details, price and inventory. Live in 8 marketplaces across NA, EU and FE.  
  * Daily SQL batch jobs join selection gaps with offer, catalog, feedback and demand data. They keep the top 1,000 gaps per brand and stream \~17M US records a day through Kinesis and Lambda into DynamoDB.  
  * Throttled DynamoDB batch writes were being dropped after two retries. Added an SQS deadletter queue drained by a rate limited retry Lambda. A CloudWatch alarm on queue age is sized from a 17M record load test.  
  * A React app calls an AppSync GraphQL API with one Lambda per operation. DynamoDB is keyed by contributor and marketplace, so each brand’s gaps sit in one partition and sorting, filtering and pagination run server side.  
  * Added filters on 30 day units sold, glance views, search impressions and star ratings. Launched pre filled bulk spreadsheets for incomplete seller listings behind a weblab.  
  * **Tech Stack:** TypeScript, Java, React, GraphQL, AWS (AppSync, Lambda, DynamoDB, Kinesis, SQS, SNS, Firehose, S3, CloudWatch), CDK, SQL  
      
* **BranchyAI – AI-Powered Ticket Resolution System**  
  * Reduced AI hallucinations in internal ticket resolution by building a decision tree UI with **Next.js** and **React Flow**, mapping team → classification → resources.  
  * Integrated with **MCP servers** to auto resolve tickets by connecting AI agents to internal tools based on classification indicators which are small prompts for each classification.  
  * Designed REST APIs to retrieve team specific decision trees and resolution resources, enabling AI to dynamically fetch context.  
  * Improved resolution accuracy and automation coverage for redundant tickets in internal Amazon support workflows.

* **MultiCreate \- Bulk Listing Creation with a Hybrid Draft Store**  
  * Built a flow where sellers create up to 20 products in one window, picking a base product to clone from a generative AI search that matches on uploaded images or a text description.  
  * Images upload straight from the browser to S3 over presigned URLs, in parallel, so image data never passes through the service.  
  * Drafts range from 10 KB to a few MB and are stored server side, split by size: under **380 KB** compressed inline in DynamoDB, above that in S3 behind a pointer. About 95% stay inline, so most loads finish in one hop.  
  * Every draft carries a version, checked on write, so two windows editing the same product can't silently overwrite each other.  
  * Saves run in the background on the product switch, so moving between products never waits on a save.  
  * Drafts persist for 7 days from the last edit and reopen on any browser or machine the seller signs in on.  
  * Handles **\~6000 TPS**, with draft loads around **50ms** from DynamoDB and **250ms** from S3.  
  * Tech Stack: Java, Spring Boot, DynamoDB, S3, Presigned URLs, Generative AI, REST APIs, React, TypeScript, CloudWatch

* **Keyword Search Redesign \- API Split, Infinite Scroll, Legacy Service Deprecation**  
  * Inherited keyword search from another team at **\~5s P99**. Traced it to an upstream aggregator resolving per seller eligibility for every result before returning anything, so page size was effectively the latency dial.  
  * Split the read path into a lightweight discovery call and an ondemand detail call. Eligibility drops from 20 calls per search to 1 on selection, decoupling first render from page size. **P99 \~600-700ms** on search, **\~300-500ms** on detail.  
  * The action link ships in the same payload as the restriction messages, so a listing cannot be cloned without its eligibility having been fetched. The gate is enforced at the API boundary, not in UI logic.  
  * Replaced fixed 20 result pages with infinite scroll via a custom React hook on an IntersectionObserver sentinel, cursor paged 10 at a time up to 1,000 results.  
  * Cancelled inflight requests with AbortController. Infinite scroll appends rather than replaces, so a stale response from an abandoned search corrupts the list instead of harmlessly overwriting it.  
  * Migrated sellers off the legacy endpoint behind a weblab, confirmed zero remaining consumers on usage dashboards, and deprecated the aggregator.  
  * Handles **\~7,500 TPS** at peak.  
  * Tech Stack: Java, Spring Boot, REST APIs, React, TypeScript, IntersectionObserver, AbortController, CloudWatch  
* **Global Search \- Cross-Region Catalog Lookup API:**   
  * Built an API that looks up 20 product IDs at once. It checks two catalogs in parallel, the caller's own region and a US fallback, instead of checking one and then the other. Most lookups miss in the home region, so this cuts out a second round trip on most requests. Handles **\~9000 TPS.**  
  * The fallback created a compliance gap. A product found in the US may be illegal to sell in the caller's country. No single service could catch this, because only the layer that merges the results knows where a result came from and who asked for it. I added the check there. One bulk call covers all 20 products instead of one call each.  
  * Cached the compliance result by product and marketplace with a short TTL. Legality does not change per seller, so I left the seller out of the key. One cached entry then serves every caller in that region.  
  * If the compliance check times out, the API returns nothing and says why. A failed search can be retried. An illegal listing cannot be undone that easily.  
  * Per seller permission checks happen later, when a user clicks a result. That keeps the list path free of per item downstream calls.  
  * **Tech Stack:** Java, Spring Boot, REST microservices, React, TypeScript

* **POD-Based Routing & Cross-Region API Architecture:** Migrated from merchant based to a seller centric POD model, improving routing consistency and reducing regional dependency. Built multi region clients for NA, EU, and FE, achieving 1 second average latency and supporting **5000 TPS** post migration.  
  * **Tech Stack:** Java, Spring Boot, REST APIs, Distributed Microservices, AWS (multi region clients for NA, EU, FE)

* **Generative AI for Product Description Automation (Amazon SellerCentral):** Developed a Generative AI solution using Amazon Bedrock to automatically generate product descriptions, reducing listing creation turnaround time by **\~50%**. Designed backend APIs and a frontend UI for seamless integration with the seller experience.  
  * **Tech Stack:** Amazon Bedrock, Generative AI, React, TypeScript, Java, Spring Boot, TanStack Router, REST APIs

* **CI/CD Automation:** Architected and implemented a robust CI/CD pipeline with multiple deployment stages (Beta, Gamma, Prod). Integrated Cypress tests to automate end to end testing.  
  * **Tech Stack:** Java, CDK, Cypress, TypeScript, JavaScript

* **Mentorship & Collaboration Initiative:** Mentored two new hires and one intern, leading the migration of legacy Java Spring Boot applications. Improved migration time through process improvements and enhanced team collaboration.  
  * **Tech Stack:** Java, Spring Boot

* **JDK-17 Migration:** Migrated from JDK 8 and JDK 11 to JDK 17, reducing garbage collection (GC) time by **84%**, CPU usage by **50%**, and memory consumption by **30%**, leading to significant application performance improvements.  
  * **Tech Stack:** Java, JDK 17

**Lead Teaching Assistant**  
*Dalhousie University, Halifax, Canada*      			                 			        Sep 2021 – Apr 2022

*   Led 4 TAs and 5 markers, supervised 24 student project groups, and built a Java tool that automated assignment distribution

**Software Engineer**  
*Amdocs, Pune, India*		         			                 				          Jul 2019 – Apr 2021

* **API Development:** Engineered Spring Boot APIs for order orchestration, achieving a 95% accuracy in delivered story points across sprints.  
* **System Optimization:** Enhanced a cloud capacity report microservice with algorithmic improvements, resulting in a 126% efficiency gain over the previous version.  
  * **Tech Stack:** Java, Spring Boot, Big Data, Networking, Linux

**Graduate Engineer Trainee**  
*Synopsys, Noida, India*		         			                 				           Jun 2019 – Jul 2019

* Automation Scripting: Developed a script to automate manual chip testing tasks, reducing effort by 50% and improving report generation accuracy. **Tech Stack:** Python, Linux, System Administration, C++  
* Product Support: Worked on the VC Spyglass CDC Synchronizer module, testing chip circuit designs to ensure adherence to quality standards. **Tech Stack:** C, C++, Python

**EDUCATION**

**Master of Applied Computer Science**			                     	    			           May 2021 – Aug 2022  
*Dalhousie University, Halifax, Canada*

* Acted as **Lab Assistant and Project Coordinator** for the **Data Management and Warehousing** course, delivering labs and managing project groups for **2 consecutive terms**

**Bachelor of Engineering** 				      	    			                         Aug 2015 – Jun 2019  
*Thapar Institute of Engineering and Technology (TIET), Punjab, India*

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAPCAYAAADd/14OAAAAO0lEQVR4XmNgIAP8RxfABkCKiFaITOMEJJlIXYUgQLRimEKSFCPzsQJkU2GKiFaMUyEIEKUIBohWiAIAOhsh3x14Mb4AAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAACTklEQVR4Xm1T3UtUQRS//1RUT9lTz7ZSkARbD216IGnuS/kglAZraCxIpIGJW4SC2QcuslGZPkTSgxsUWQuxEVTiQ4V7596ZM9M5c2bmuuYwzD0z9/zOx++cE8XKpNoIhRvw5KW1dlL7QoUE3EY5wg/ihaQz9uADl7ZgYdVIABPxPey9HlvG7LZHQDrSecJIPVjuB79p/l2qbz/Z3EGBXzAXYQPe1cBhErilTcKZQwY+O3g9SRKRxueLo/7N5SzQCm4GIywG4Duv031DSqUso8P8UJnl1AfoCMOAyafWhJcOfHN+fbpWr334+fzjr5na5sTCKr8zDLdiMKfOkQS2T5zrm3z6rtH8/uXrt7HF9Y1PTePZdmE7z57nmH5orrCUsjS/xoZKD18bcEYJzDnapiCwVJgtUMGl42vu2YtrsyuV5Vf3q2sjsysPqi/ZKOZsAyak94xpGIilSryHo12FK1OPO7ovdZzpvzr16EhXT/AsFXl2hFHOWlljIDwYvRQnF1keKC+41705Z57ZOWSlKleWesYqLPeW5v4kHiwJjNXxpbLGuF0D2/nhO3erby+MzhRu3Jte3sgP3yYmbUXQDlIjlLQdJl2R0XPs2/P4qUJ9q8GG3n9uHOvuN9lgQMtoVE54MGzdbRqQDePWj98sbAv+0opTAmO1qClde0pmD7ASobdzxVsnByc6L4/nBsYD2E4+qXGaEUfLTYfBBzAKhzoLh3MXA9IYGiYmyIFtu4QRbZvn/1coDScfcYUtgSTs0wagjg1XVLPsQCuVeP4DqFpgwJryQ4YAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAASCAYAAABb0P4QAAAAZ0lEQVR4Xu2Q0QnAMAhEHbEjdYOM0JE6UosfgtydSUnzmQdCfHogMdus5PlZRDkYUOZCymFBN5Olv+/UI5fxPoHyFM5x14QjUMbf4CUHuPCECuYeQ7hPhJTDgm5GXfGFMheD2dos4gWD0EfZVEYFSgAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAMCAMAAABlXnzoAAADAFBMVEUAAAAYGBgLCwsSEhIpKSk+Pj43NzchISEuLi5eXl5VVVVFRUVQUFBsbGx0dHR7e3tjY2OEhISQkJCXl5e7u7urq6uxsbGhoaHT09PDw8Pf39/JycnZ2dnr6+v6+vry8vL///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC+xuOPAAAAOElEQVR4XmNUYEAGLAwPGBgQQkxwFhgwKqDyQVyYkIICiuIHQKNgMgyP/qEYJceAYTJ+LqMCChcAAlwE9pXhmU8AAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAADAFBMVEUAAAD////+/v78/Pz9/f37+/v6+vpZWVkBAQECAgJISEj4+PhVVVUDAwMAAABoaGjs7OwWFhYICAjX19cLCwtDQ0MnJydXV1eEhITg4OAEBAQvLy97e3sFBQXh4eH39/fOzs4kJCQNDQ319fXm5uYaGhrV1dXy8vJmZmb5+fkGBgYlJSUUFBSTk5OpqanS0tI+Pj4QEBCwsLCgoKDq6uqtra1ra2sHBweAgIDw8PDFxcXb29tOTk62trYeHh4uLi4ODg67u7uPj4/29va+vr4bGxs1NTUdHR03NzeZmZkJCQn09PQTExPu7u7Q0NDn5+fl5eUgICDZ2dnt7e3T09Pv7+/c3NxHR0d9fX2vr68jIyPp6ekMDAwfHx85OTnGxsbx8fFWVlaIiIhJSUlBQUHo6OgcHByXl5fMzMzHx8eamprPz8+5ubnCwsLW1tZhYWEzMzO1tbWrq6uHh4fY2Nh4eHilpaVzc3NpaWlKSkrr6+uDg4OsrKzf399QUFCzs7Pa2tqnp6fi4uI0NDQiIiIKCgqFhYUZGRkxMTGoqKgPDw8hISE8PDwwMDBFRUXLy8srKyspKSnExMSRkZFycnJaWloyMjJ1dXXz8/OdnZ2kpKS6urqVlZVvb2/e3t58fHyqqqpNTU1bW1s9PT2Li4vIyMiBgYFiYmJLS0uMjIwsLCzj4+PKysqenp52dna0tLRqampGRkZSUlKjo6NsbGyxsbHDw8MSEhLk5ORTU1N3d3dPT08XFxcmJiaKiopAQEA/Pz8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABPHLGHAAAAAXRSTlMAQObYZgAAAJVJREFUeF6VUDkOg0AMHLPFFpGp+Ah1PkABJX/IP5J/8EhEs0WExywIQigYydfsemxZBGcUvwRxi9S3RWVB55UsqM3KnEvI06cEJE1b+2MA2u9SAkPl7ex0lOyncboPMYwxJ6Y5waRcLpiLMR33fK6JyMf1NmEz7vniDCu69UEOV9LRAzVboKdTkGsouf+ZcXWlM/6SM6sxE8PkXybVAAAAAElFTkSuQmCC>
