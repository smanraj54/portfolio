**MANRAJ SINGH**

*Permanent Resident \- **Canada***

1105 \- 13350 Central Ave Surrey, BC, V3T 0S1

**![Receiver with solid fill][image1](902) 412-9128       ![Envelope with solid fill][image2][smanraj54@gmail.com](mailto:smanraj54@gmail.com)       ![][image3][LinkedIn Profile-smanraj54](https://www.linkedin.com/in/smanraj54/)	        ![][image4][GitHub-smanraj54](https://github.com/smanraj54)**

&nbsp;

**PROFILE**&nbsp;

&nbsp;

Senior Software Engineer with 7.2 years building backend and distributed systems, including 3.5 years at Amazon. Recent work spans cloud application architecture on AWS, real-time protocol design over WebSockets and gRPC, and retrieval-augmented generation over large numbers of documents. Comfortable owning a service end to end, from API design through deployment, and cutting latency on systems already in production.

&nbsp;

**CORE COMPETENCIES**&nbsp;

&nbsp;

* Languages: Java (Advanced), TypeScript, Python, Node.js, Kotlin, C++  
* Backend: Spring Boot, Node.js, gRPC, WebSockets, REST APIs, Microservices&nbsp;  
* Frontend: React, Angular, Redux, TypeScript, Electron, HTML/CSS  
* Databases: PostgreSQL, MySQL, MongoDB, DynamoDB, OpenSearch  
* Cloud (AWS): EKS, ECS, Lambda, EC2, S3, EFS, ECR, RDS, DynamoDB, API Gateway,CloudFront, Bedrock, WAF, CloudFormation, CDK  
* DevOps & CI/CD: Docker, GitHub Actions, Cypress, Maven  
* AI/ML: Retrieval-Augmented Generation, Vector Search, Embeddings, Amazon Bedrock, MCP servers.  
* Architectures: Distributed Systems, Microservices, Cloud-Native, Event-Driven  
* Performance: Latency Reduction, High-Throughput API Design

&nbsp;

**WORK EXPERIENCE**

&nbsp;

**Senior Software Engineer**

*Ansys (Acquired by Synopsys), Canada*	         	                 			              September 2025 – Current

&nbsp;

* **AEDT Doc Copilot \- Retrieval-Augmented Generation (RAG) Assistant for Product Documentation**  
  * Built a RAG pipeline over the Ansys documentation corpus so customers can ask questions in natural language from a chat panel inside the application, instead of searching the docs or filing a support ticket.  
  * Designed the ingestion pipeline: documents are parsed, chunked along section boundaries, embedded, and indexed for hybrid retrieval, so a query matches on meaning and on exact keyword together.  
  * Grounded every answer in retrieved passages with citations linking back to the source page, and had the assistant decline when retrieval returns nothing relevant rather than guessing.  
  * Deployed on AWS behind CloudFront and API Gateway, with the vector index in OpenSearch Serverless and generation through Amazon Bedrock. Infrastructure defined in CDK  
  * Secured the public endpoint with SSO token verification and per-tenant entitlement checks, with AWS WAF rate limiting to bound query volume per user and cap cost exposure on a metered LLM path.  
  * **Tech Stack:** Python, TypeScript, Amazon Bedrock, RAG, Vector Search, Embeddings, OpenSearch, AWS (Lambda, API Gateway, CloudFront, S3, WAF), CDK, GitHub Actions

&nbsp;

* **Concept SI \- Web Platform for 3D Circuit Board Simulation**  
  * Moved a Windows-only desktop tool to the web. The simulation engines already existed as native services. I built a layer that lets a browser drive them.  
  * Designed a WebSocket protocol carrying approx 30 operations, translated to gRPC on the backend. Requests are matched by ID so many can run at once over one connection.  
  * Design files run past 500 MB, so services never send them to each other. Files land once on a shared EFS volume and every service reads from the same path.  
  * Gave each user their own copy of a file, keyed by their SSO identity. Two people can open the same design without conflicting, so no locking was needed.  
  * Secured every backend call with SSO token verification, plus guards against SSRF, path traversal, and NoSQL injection.  
  * Packaged every service as a container image and deployed the stack to a managed cluster on AWS, with per-environment configuration so cloud and on-prem installs run from the same images. Builds publish through GitHub Actions on merge.  
  * Packaged the same stack as an Electron desktop app so customers who can't put data in the cloud run everything locally. Only the configuration changes.  
  * **Tech Stack:** Node.js, TypeScript, gRPC, WebSockets, Angular, MongoDB, Docker, AWS (EKS, ECR, EFS, S3, CloudFront), GitHub Actions

  &nbsp;

**Software Development Engineer**

*Amazon, Canada*		         			                 			     May 2022 – September 2025

&nbsp;

* **BranchyAI – AI-Powered Ticket Resolution System**  
  * Reduced AI hallucinations in internal ticket resolution by building a decision-tree UI with **Next.js** and **React Flow**, mapping team → classification → resources.  
  * Integrated with **MCP servers** to auto-resolve tickets by connecting AI agents to internal tools based on classification indicators which are small prompts for each classification.  
  * Designed REST APIs to retrieve team-specific decision trees and resolution resources, enabling AI to dynamically fetch context.  
  * Improved resolution accuracy and automation coverage for redundant tickets in internal Amazon support workflows.

&nbsp;

* **MultiCreate \- Bulk Listing Creation with a Hybrid Draft Store**  
  * Built a flow where sellers create up to 20 products in one window, picking a base product to clone from a generative AI search that matches on uploaded images or a text description.  
  * Images upload straight from the browser to S3 over presigned URLs, in parallel, so image data never passes through the service.  
  * Drafts range from 10 KB to a few MB and are stored server-side, split by size: under **380 KB** compressed inline in DynamoDB, above that in S3 behind a pointer. About 95% stay inline, so most loads finish in one hop.  
  * Every draft carries a version, checked on write, so two windows editing the same product can't silently overwrite each other.  
  * Saves run in the background on the product switch, so moving between products never waits on a save.  
  * Drafts persist for 7 days from the last edit and reopen on any browser or machine the seller signs in on.  
  * Handles **\~6000 TPS**, with draft loads around **50ms** from DynamoDB and **250ms** from S3.  
  * Tech Stack: Java, Spring Boot, DynamoDB, S3, Presigned URLs, Generative AI, REST APIs, React, TypeScript, CloudWatch

&nbsp;

* **Keyword Search Redesign \- API Split, Infinite Scroll, Legacy Service Deprecation**  
  * Inherited keyword search from another team at **\~5s P99**. Traced it to an upstream aggregator resolving per-seller eligibility for every result before returning anything, so page size was effectively the latency dial.  
  * Split the read path into a lightweight discovery call and an on-demand detail call. Eligibility drops from 20 calls per search to 1 on selection, decoupling first render from page size. **P99 \~600-700ms** on search, **\~300-500ms** on detail.  
  * The action link ships in the same payload as the restriction messages, so a listing cannot be cloned without its eligibility having been fetched. The gate is enforced at the API boundary, not in UI logic.  
  * Replaced fixed 20-result pages with infinite scroll via a custom React hook on an IntersectionObserver sentinel, cursor-paged 10 at a time up to 1,000 results.  
  * Cancelled in-flight requests with AbortController. Infinite scroll appends rather than replaces, so a stale response from an abandoned search corrupts the list instead of harmlessly overwriting it.  
  * Migrated sellers off the legacy endpoint behind a weblab, confirmed zero remaining consumers on usage dashboards, and deprecated the aggregator.  
  * Handles **\~7,500 TPS** at peak.  
  * Tech Stack: Java, Spring Boot, REST APIs, React, TypeScript, IntersectionObserver, AbortController, CloudWatch  
* **Global Search \- Cross-Region Catalog Lookup API:**&nbsp;  
  * Built an API that looks up 20 product IDs at once. It checks two catalogs in parallel, the caller's own region and a US fallback, instead of checking one and then the other. Most lookups miss in the home region, so this cuts out a second round trip on most requests. Handles **\~9000 TPS.**  
  * The fallback created a compliance gap. A product found in the US may be illegal to sell in the caller's country. No single service could catch this, because only the layer that merges the results knows where a result came from and who asked for it. I added the check there. One bulk call covers all 20 products instead of one call each.  
  * Cached the compliance result by product and marketplace with a short TTL. Legality does not change per seller, so I left the seller out of the key. One cached entry then serves every caller in that region.  
  * If the compliance check times out, the API returns nothing and says why. A failed search can be retried. An illegal listing cannot be undone that easily.  
  * Per-seller permission checks happen later, when a user clicks a result. That keeps the list path free of per-item downstream calls.  
  * **Tech Stack:** Java, Spring Boot, REST microservices, React, TypeScript

&nbsp;

* **POD-Based Routing & Cross-Region API Architecture:** Migrated from merchant-based to a seller-centric POD model, improving routing consistency and reducing regional dependency. Built multi-region clients for NA, EU, and FE, achieving 1-second average latency and supporting **5000 TPS** post-migration.  
  * **Tech Stack:** Java, Spring Boot, REST APIs, Distributed Microservices, AWS (multi-region clients for NA, EU, FE)

&nbsp;

* **Generative AI for Product Description Automation (Amazon SellerCentral):** Developed a Generative AI solution using Amazon Bedrock to automatically generate product descriptions, reducing listing creation turnaround time by **\~50%**. Designed backend APIs and a frontend UI for seamless integration with the seller experience.  
  * **Tech Stack:** Amazon Bedrock, Generative AI, React, TypeScript, Java, Spring Boot, TanStack Router, REST APIs

&nbsp;

* **CI/CD Automation:** Architected and implemented a robust CI/CD pipeline with multiple deployment stages (Beta, Gamma, Prod). Integrated Cypress tests to automate end-to-end testing.  
  * **Tech Stack:** Java, CDK, Cypress, TypeScript, JavaScript

&nbsp;

* **Mentorship & Collaboration Initiative:** Mentored two new hires and one intern, leading the migration of legacy Java Spring Boot applications. Improved migration time through process improvements and enhanced team collaboration.  
  * **Tech Stack:** Java, Spring Boot

&nbsp;

* **JDK-17 Migration:** Migrated from JDK 8 and JDK 11 to JDK 17, reducing garbage collection (GC) time by **84%**, CPU usage by **50%**, and memory consumption by **30%**, leading to significant application performance improvements.  
  * **Tech Stack:** Java, JDK 17

&nbsp;

**Lead Teaching Assistant**

*Dalhousie University, Halifax, Canada*      			                 			        Sep 2021 – Apr 2022

&nbsp;

*   Led 4 TAs and 5 markers, supervised 24 student project groups, and built a Java tool that automated assignment distribution

&nbsp;

**Software Engineer**

*Amdocs, Pune, India*		         			                 				          Jul 2019 – Apr 2021

&nbsp;

* **API Development:** Engineered Spring Boot APIs for order orchestration, achieving a 95% accuracy in delivered story points across sprints.  
* **System Optimization:** Enhanced a cloud capacity report microservice with algorithmic improvements, resulting in a 126% efficiency gain over the previous version.  
  * **Tech Stack:** Java, Spring Boot, Big Data, Networking, Linux  
* **Debugging and RCA:** Conducted comprehensive root cause analyses, resolving issues and providing optimized solutions with up to 30% faster processing times.  
* **Stakeholder Engagement:** Delivered demos of developed solutions to stakeholders, fostering better communication and aligning deliverables with business objectives using written communication and collaboration skills.&nbsp;

**Graduate Engineer Trainee**

*Synopsys, Noida, India*		         			                 				           Jun 2019 – Jul 2019

* Automation Scripting: Developed a script to automate manual chip testing tasks, reducing effort by 50% and improving report generation accuracy. **Tech Stack:** Python, Linux, System Administration, C++  
* Product Support: Worked on the VC Spyglass CDC Synchronizer module, testing chip circuit designs to ensure adherence to quality standards. **Tech Stack:** C, C++, Python

&nbsp;

&nbsp;

&nbsp;

**PROJECTS**

&nbsp;

* **Designing and implementing RDBMS in JAVA from scratch:** [Link](https://github.com/smanraj54/RDBMS_JAVA_Project)  
  * **Tech Stack:** Java, Design Patterns, Data Structures, TDD, Maven  
* **Cab booking Management:** [Link](https://github.com/smanraj54/Cab_Booking_Management_Project)  
  * **Tech Stack:** Java, SOLID Principles, Design Patterns, Test Driven Development, Maven, CI/CD, GitFlow, AWS SNS  
* **Hiree: (Online job posting and finding portal)** [Link](https://github.com/smanraj54/Hiree)  
  * **Tech Stack:** Java, Spring Boot, Docker, Maven, AWS (EC2, SNS, RDS, S3).  
* **Volunteer Mart:** [Link](https://github.com/smanraj54/Volunteer-Mart-React)  
  * **Tech Stack:** React, Node.js, GCP (Relational Database)

&nbsp;

**EDUCATION**

&nbsp;

**Master of Applied Computer Science**			                     	    			           May 2021 – Aug 2022

*Dalhousie University, Halifax, Canada*

* Acted as **Lab Assistant and Project Coordinator** for the **Data Management and Warehousing** course, delivering labs and managing project groups for **2 consecutive terms**

&nbsp;

**Bachelor of Engineering** 				      	    			                         Aug 2015 – Jun 2019

*Thapar Institute of Engineering and Technology (TIET), Punjab, India*

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAPCAYAAADd/14OAAAAO0lEQVR4XmNgIAP8RxfABkCKiFaITOMEJJlIXYUgQLRimEKSFCPzsQJkU2GKiFaMUyEIEKUIBohWiAIAOhsh3x14Mb4AAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAASCAYAAABb0P4QAAAAZ0lEQVR4Xu2Q0QnAMAhEHbEjdYOM0JE6UosfgtydSUnzmQdCfHogMdus5PlZRDkYUOZCymFBN5Olv+/UI5fxPoHyFM5x14QjUMbf4CUHuPCECuYeQ7hPhJTDgm5GXfGFMheD2dos4gWD0EfZVEYFSgAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAMCAMAAABlXnzoAAADAFBMVEUAAAAYGBgLCwsSEhIpKSk+Pj43NzchISEuLi5eXl5VVVVFRUVQUFBsbGx0dHR7e3tjY2OEhISQkJCXl5e7u7urq6uxsbGhoaHT09PDw8Pf39/JycnZ2dnr6+v6+vry8vL///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC+xuOPAAAAOElEQVR4XmNUYEAGLAwPGBgQQkxwFhgwKqDyQVyYkIICiuIHQKNgMgyP/qEYJceAYTJ+LqMCChcAAlwE9pXhmU8AAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAADAFBMVEUAAAD////+/v78/Pz9/f37+/v6+vpZWVkBAQECAgJISEj4+PhVVVUDAwMAAABoaGjs7OwWFhYICAjX19cLCwtDQ0MnJydXV1eEhITg4OAEBAQvLy97e3sFBQXh4eH39/fOzs4kJCQNDQ319fXm5uYaGhrV1dXy8vJmZmb5+fkGBgYlJSUUFBSTk5OpqanS0tI+Pj4QEBCwsLCgoKDq6uqtra1ra2sHBweAgIDw8PDFxcXb29tOTk62trYeHh4uLi4ODg67u7uPj4/29va+vr4bGxs1NTUdHR03NzeZmZkJCQn09PQTExPu7u7Q0NDn5+fl5eUgICDZ2dnt7e3T09Pv7+/c3NxHR0d9fX2vr68jIyPp6ekMDAwfHx85OTnGxsbx8fFWVlaIiIhJSUlBQUHo6OgcHByXl5fMzMzHx8eamprPz8+5ubnCwsLW1tZhYWEzMzO1tbWrq6uHh4fY2Nh4eHilpaVzc3NpaWlKSkrr6+uDg4OsrKzf399QUFCzs7Pa2tqnp6fi4uI0NDQiIiIKCgqFhYUZGRkxMTGoqKgPDw8hISE8PDwwMDBFRUXLy8srKyspKSnExMSRkZFycnJaWloyMjJ1dXXz8/OdnZ2kpKS6urqVlZVvb2/e3t58fHyqqqpNTU1bW1s9PT2Li4vIyMiBgYFiYmJLS0uMjIwsLCzj4+PKysqenp52dna0tLRqampGRkZSUlKjo6NsbGyxsbHDw8MSEhLk5ORTU1N3d3dPT08XFxcmJiaKiopAQEA/Pz8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABPHLGHAAAAAXRSTlMAQObYZgAAAJVJREFUeF6VUDkOg0AMHLPFFpGp+Ah1PkABJX/IP5J/8EhEs0WExywIQigYydfsemxZBGcUvwRxi9S3RWVB55UsqM3KnEvI06cEJE1b+2MA2u9SAkPl7ex0lOyncboPMYwxJ6Y5waRcLpiLMR33fK6JyMf1NmEz7vniDCu69UEOV9LRAzVboKdTkGsouf+ZcXWlM/6SM6sxE8PkXybVAAAAAElFTkSuQmCC>