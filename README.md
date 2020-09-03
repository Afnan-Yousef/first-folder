# :warning: Pre-Requisites

### 1-	Install Homebrew:
```
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```
### 2-	Install Java    
```
Brew cask install java
```
:info: To check if JAVA installed correctly, write the following command `java -version` in terminal


### 3- Install Apache-Maven
```
Brew install maven
```
:Info: To check if maven installed correctly, write the following command `mvn -version` in terminal

### 4-	Install IDE (STS,Eclipse ..)
It is highly recommended to use Spring Tool Suite (STS) instead of Eclipse. 
Please refer to this link: https://spring.io/tools3/sts/legacy

### 5-	Project
Clone/Download the project, then import it in your IDE   
```
git clone https://github.com/KargoGlobal/QAAdvertisersWebAutomation.git
```

### 6-	Attaching setting.xml file

Add this file in the following path **/Users/UserName/.m2/settings.xml**.
This file will give you a permission to use a predefined methods.

you can find it in the installed project, in the following path:
**MPAutomation/src/settings.xml** 


## Project structure overview
--------------------------------------------------------------------------------------------
### :top: A typical top-level directory layout
#### Shown only important folders
    .
    ├── ...
    ├── src/main/java                             #
    │   ├── com.aspire.kargo.pages                # Declaration for the used selectors(locators) 
    │   ├── com.aspire.kargo.pages.common         # Declaration for the Global used selectors(locators)
    │   └── com.aspire.kargo.steps                # Custom methods folder
    │
    ├── src/main/resources                        #
    │   ├── application.yml                       # Run configrations file
    │
    ├── src/test/java                             #
    │   ├── com.aspire.automation.poc             # Running file
    │
    ├── src/test/resources                        #
    │   ├── config                                # Values of parameters(names, credentials..) and selector(locators)
    │   └── stories                               # Test cases folder
    └── ...

--------------------------------------------------------------------------------------------

# :writing_hand: Writing Tests
 You can go through the following steps to create a new test cases:

#### - For Selectors:

1) Create a new File under “**src/test/resources/Configs**” folder and name it with “**.properties**” extension.

2) All selectors should be listed under “**.properties**” file extension using the same format.

3) It is better to list all selectors related to a specific page/functionality in a separate “**.properties**” file. 

##### Example:
> “TopNav.properties” will include Top Nav Selectors 

##### such as:
> Sign_In_Link: value Or by using the following format => "**pages.nameOfPage.selectorName= value**” .

#### - For Pages (Main Methods):


> Create Java “**interface-Class**” for each page in “**src/main/java**” “**com.aspire.pages**” Folder. 
Add “**@Page**” tag above interface-Class Name


##### Example:
> **@Page(name=" pageName ",url="${ pages.nameOfClass.URL }”)**
Note: “URL” parameter should be empty in case you don’t wont to navigate to any URL. 



#### - For Creating Methods to Call selectors

In the previously created interface add the selectors methods as following: 
Example:

`@CssSelector(“${pages.nameOfClass.selectorName}”)`

public AspireWebElement selectorName();}

#### :info: Note:

1) “selectorName” is case sensitive.
2) User can use: ID, ClassName, Name, Link Text, and XPath locators for identifying web elements in a web page. 

i.e. 
`@IDSelector`,`@PartialLinkTextSelector`,`@XPathSelector`, `@LinkTextSelector`, `@ClassNameSelector`, `@NameSelector`
or `@LinkTextSelector`
method would be look like the following

i.e. `@IDSelector(“${pages.nameOfClass.selectorName}”)`
`public AspireWebElement selectorName();}`


#### :info: Note:
In `.properties` page the locater should be compatible with the declaration in the interface
i.e. if we use
> @XPathSelector("${gallery}")
>	public AspireWebElement gallery();
> gallery= //android.widget.TextView[contains(@text,"Gallery”)]


#### - For Writing test cases 

Generic steps are already defined steps in the new framework and they linked with the code so no need to write a script to implement them, just select the step and add the locators as needed.

You should use them while creating new test cases; they are covering the most common steps like (click, display, send keys, assert....).We can add a custom step but this will be just for the special cases. 

#### How to use Generic steps:

Each step has a combination of numbers in its beginning, and each number refers to a specific meaning.

For example the combination number [1100-1340] in the below step .......: 
`When [1100-1340] User fills User Name with Valid User Name`
We've added numbers for each step so we can easily access and search for them And the numbers mapping explanation are as the following:

### [#1 #2 #3 #4 - #5 #6 #7 #8 ] 


#1 can be: `1 -> Web/Mobile`, `2-> Rest API`, `3 -> Database`, `8 -> For the Custom step`

#2 can be: `0 -> Page`, `1 -> Element`, `2 -> Elements`, `3 -> Mobile specific steps`

#3 can be: `0 -> Without Timeout`, `1 -> With Timeout`

#4 can be :`0 -> General or Action`, `1 -> Assert`, `2 -> State`

#5 can be: `0 -> URL or Last accessed element`, `1 -> T ext or element`, `2 -> Alert`, `3 -> Window`, `4->Tab`, `5 -> Cookies`, `6 -> Frame`, `9 -> General`

#6 can be: `0 -> State`, `1 -> Text`, `2 -> Value`, `3 -> Action`,  `4->CSS`, `5 -> Attribute` 

#7 And #8: will have serial numbers

            Additionally, -S can be added after the number (for generic or custom steps) to inform automation framework to use a soft assertion for this step. 

##### Example in the following step:

When [1100-1340] User fills User Name with `Valid User Name`

I have a web page and I need a fill action to write a text in element:

#1 = 1, and refers to a web.

#2 = 1, and refers to an element.

#3 = 0, refers to without timeout.

#4= 0, and refers to an action.

#5= 1, and refers to Text.

#6= 3, and refer to an Action.

#7 and #8 took a serial number 4 and 0.

# :zap: Run test cases

Uncomment value of this key !—pages.site.main.url from the following path: 
`QAAdvertisersWebAutomation/src/test/resources/config/selectors/common/`


In the IDE or terminal you can run all test cases or group of test cases grouped by folder or test cases grouped by tags or individual,

- On STS under the imported project:
  - Navigate to “src/main/resources” folder on left hand side and double click on it.
  - Double click on “application.yml”
  - At line “13” set value of include key as follows:
    - `stories/**/TC-login-001.story` // to run specific test case, i.e. login test case
    - `stories/**/TC-login**.story` // to run all test cases start with “login”
    - `stories/**/*.story` // to run all stories
Note: You can get story name from this path: `{ProjectPath}/{ProjectName}/src/test/resources/stories”` i.e. `/Users/afnanyousef/Documents/KoUI/src/test/resources/stories`, where all stories are saved. 
- After setting the `include` key:
  - Double click on `src/test/java` Folder
  - Double click on `com.aspire.automation.poc` Folder
  - Right click on `AspireAutomationKargoApplicationTest.java` file -> Run as -> JUnit test. 
- In case you want to run using terminal rather than IDE do the first three steps then in terminal:
 Navigate to project path i.e. `cd /Users/afnanyousef/Documents/workspace/MPAutomation`

- Run the following command

```
man clean test
```

--------------------------------------------------------------------------------------------

# Report:

You can check results from:

- [Aspire Dashboard](http://82.212.71.230:5080/login?redirectUrl=%2Fdashboard)
- Checking terminal
- Checking local report
