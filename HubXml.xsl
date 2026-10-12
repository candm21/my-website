<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:mml="http://www.w3.org/1998/Math/MathML" xmlns:m="http://www.w3.org/1998/Math/MathML" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns="http://www.w3.org/1999/xhtml" exclude-result-prefixes="mml xs" version="2.0">

	<xsl:output method="html" doctype-public="-//W3C//DTD HTML 4.01 Transitional//EN" doctype-system="http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd" indent="no" name="html"/>

	<!-- HTML Generation Start -->
	<xsl:template match="/">
		<html xmlns="http://www.w3.org/1999/xhtml" lang="en">

			<head>
				<meta charset="utf-8"/>
				<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
				<meta name="viewport" content="width=device-width, initial-scale=1"/>
				<meta name="description" content=""/>
				<meta name="author" content=""/>
				<title>BrowserView</title>
				<link href="file:\\\D:\Tools\HUB_XML\Tools\Browser_View\HubXml.css" rel="stylesheet"/>

				<!--<script type="text/javascript" src="Nav.js"/>-->
			</head>

			<body>
				<div id="wrapper">
					<!-- Sidebar -->
					<div id="sidebar-wrapper">
						<ul class="sidebar-nav">
							<li class="sidebar-brand">Table of Contents</li>
							<xsl:for-each select="//body/div[@class = 'metadata']">
								<li class="metanav">
									<a>
										<xsl:attribute name="href">
											<xsl:value-of select="concat('#', @id)"/>
										</xsl:attribute>
										<!--										<xsl:attribute name="onclick">
											<xsl:text disable-output-escaping="yes">Navigation('</xsl:text>
											<xsl:choose>
												<xsl:when test="@id">
													<xsl:value-of select="@id"/>
												</xsl:when>
												<xsl:otherwise>
													<xsl:value-of select="concat('fm', count(preceding-sibling::div) + 1)"/>
												</xsl:otherwise>
											</xsl:choose>
											<xsl:text disable-output-escaping="yes">')</xsl:text>
										</xsl:attribute>
-->
										<xsl:value-of select="@class"/>
									</a>
								</li>
							</xsl:for-each>

							<xsl:for-each select="//body/div[@class = 'frontmatter']/div">
								<li class="fmnav">
									<a>
										<xsl:attribute name="href">
											<xsl:value-of select="concat('#', @id)"/>
										</xsl:attribute>
										<!--										<xsl:attribute name="onclick">
											<xsl:text disable-output-escaping="yes">Navigation('</xsl:text>
											<xsl:choose>
												<xsl:when test="@id">
													<xsl:value-of select="@id"/>
												</xsl:when>
												<xsl:otherwise>
													<xsl:value-of select="concat('fm', count(preceding-sibling::div) + 1)"/>
												</xsl:otherwise>
											</xsl:choose>
											<xsl:text disable-output-escaping="yes">')</xsl:text>
										</xsl:attribute>-->
										<xsl:value-of select="concat(@class, ': ' )"/>
										<xsl:value-of select="div[@class = 'metadata']/div/p[@class = 'main']"/>
									</a>
								</li>
							</xsl:for-each>
							<li class="chnav">&#x00A0;</li>

							<xsl:for-each select="//body/div[@class = 'text']/div[@class = 'introduction']|//body/div[@class = 'text']/div[@class = 'part']|//body/div[@class = 'text']/div[@class = 'chapter']|//body/div[@class = 'text']/div/div[@class = 'chapter']">
								<li>
									<xsl:choose>
										<xsl:when test="@class = 'part'">
											<xsl:attribute name="class">partnav</xsl:attribute>
										</xsl:when>
										<xsl:otherwise>
											<xsl:attribute name="class">chnav</xsl:attribute>
										</xsl:otherwise>
									</xsl:choose>
									<a>
										<xsl:attribute name="href">
											<xsl:value-of select="concat('#', @id)"/>
										</xsl:attribute>
										<!--										<xsl:attribute name="onclick">
											<xsl:text disable-output-escaping="yes">Navigation('</xsl:text>
											<xsl:choose>
												<xsl:when test="@id">
													<xsl:value-of select="@id"/>
												</xsl:when>
												<xsl:otherwise>
													<xsl:value-of select="concat('fm', count(preceding-sibling::div) + 1)"/>
												</xsl:otherwise>
											</xsl:choose>
											<xsl:text disable-output-escaping="yes">')</xsl:text>
										</xsl:attribute>-->
										<xsl:variable name="rpsclass">
											<xsl:value-of select="@class"/>
										</xsl:variable>
										<xsl:value-of select="concat(@class, ' ', count(preceding::div[@class = $rpsclass]) + 1, ': ' )"/>
										<xsl:value-of select="div[@class = 'metadata']/div/p[@class = 'main']"/>
									</a>
								</li>
							</xsl:for-each>
							<li class="chnav">&#x00A0;</li>

							<xsl:for-each select="//body/div[@class = 'backmatter']/div">
								<li class="bmnav">
									<a>
										<xsl:attribute name="href">
											<xsl:value-of select="concat('#', @id)"/>
										</xsl:attribute>
										<!--										<xsl:attribute name="onclick">
											<xsl:text disable-output-escaping="yes">Navigation('</xsl:text>
											<xsl:choose>
												<xsl:when test="@id">
													<xsl:value-of select="@id"/>
												</xsl:when>
												<xsl:otherwise>
													<xsl:value-of select="concat('fm', count(preceding-sibling::div) + 1)"/>
												</xsl:otherwise>
											</xsl:choose>
											<xsl:text disable-output-escaping="yes">')</xsl:text>
										</xsl:attribute>-->
										<xsl:value-of select="concat(@class, ': ' )"/>
										<xsl:value-of select="div[@class = 'metadata']/div/p[@class = 'main']"/>
									</a>
								</li>
							</xsl:for-each>
							<li class="chnav">&#x00A0;</li>
							<li class="chnav">&#x00A0;</li>
						</ul>
					</div>

					<div id="page-content-wrapper">
						<xsl:apply-templates/>
					</div>
				</div>

			</body>
		</html>

		<!-- Part -->
		<!--		<xsl:for-each select="//body/div[@class = 'text']/div[@class = 'introduction']">
			<xsl:variable name="filename">
				<xsl:value-of select="concat(base-uri(), '_ePub/OEBPS/')"/>
				<xsl:value-of select="'introduction'"/>
				<xsl:value-of select="'.xlink.html'"/>
			</xsl:variable>

			<xsl:result-document href="{$filename}" format="html">
				<html>
					<xsl:copy-of select="$htmlhead"/>
					<body>
						<div>
							<xsl:apply-templates select="*"/>
						</div>
					</body>
				</html>
			</xsl:result-document>
		</xsl:for-each>

		<xsl:for-each select="//body/div[@class = 'text']/div[@class = 'part']">
			<xsl:variable name="parttemp">
				<xsl:value-of select="count(preceding::div[@class = 'part']) + 1"/>
			</xsl:variable>
			<xsl:variable name="part">
				<xsl:number value="$parttemp" format="0000"/>
			</xsl:variable>
			<xsl:variable name="filename">
				<xsl:value-of select="concat(base-uri(), '_ePub/OEBPS/', 'part')"/>
				<xsl:value-of select="$part"/>
				<xsl:value-of select="'.xlink.html'"/>
			</xsl:variable>

			<xsl:result-document href="{$filename}" format="html">
				<html>
					<xsl:copy-of select="$htmlhead"/>
					<body>
						<div>
							<xsl:apply-templates select="* except div[@class = 'chapter']"/>
						</div>
					</body>
				</html>
			</xsl:result-document>
		</xsl:for-each>
-->
		<!-- Chapter -->
		<!--		<xsl:for-each select="//body/div[@class = 'text']/div[@class = 'chapter']|//body/div[@class = 'text']/div/div[@class = 'chapter']">
			<xsl:variable name="chaptemp">
				<xsl:choose>
					<xsl:when test="contains(lower-case(//div[@class = 'text']/div[@class = 'chapter'][1]/h1/span[@class = 'label']), 'introduction') or (not(//div[@class = 'text']/div[@class = 'chapter'][1]/h1/span[@class = 'label']) and contains(lower-case(//div[@class = 'text']/div[@class = 'chapter'][1]/h1), 'introduction'))">
						<xsl:value-of select="count(preceding::div[@class = 'chapter'])"/>
					</xsl:when>
					<xsl:otherwise>
						<xsl:value-of select="count(preceding::div[@class = 'chapter']) + 1"/>
					</xsl:otherwise>
				</xsl:choose>
			</xsl:variable>
			<xsl:variable name="chap">
				<xsl:number value="$chaptemp" format="0000"/>
			</xsl:variable>
			<xsl:variable name="filename">
				<xsl:value-of select="concat(base-uri(), '_ePub/OEBPS/', 'ch')"/>
				<xsl:value-of select="$chap"/>
				<xsl:value-of select="'.xlink.html'"/>
			</xsl:variable>

			<xsl:result-document href="{$filename}" format="html">
				<html>
					<xsl:copy-of select="$htmlhead"/>
					<body>
						<div>
							<xsl:apply-templates/>
						</div>
					</body>
				</html>
			</xsl:result-document>
		</xsl:for-each>
-->
		<!-- Back Matter -->
		<!--		<xsl:for-each select="//body/div[@class = 'backmatter']/div">
			<xsl:variable name="currclass" select="@class"/>
			<xsl:variable name="filename">
				<xsl:value-of select="concat(base-uri(), '_ePub/OEBPS/')"/>
				<xsl:choose>
					<xsl:when test="preceding-sibling::div[@class = $currclass]">
						<xsl:variable name="bmtemp">
							<xsl:value-of select="count(preceding-sibling::div) + 1"/>
						</xsl:variable>
						<xsl:variable name="bm">
							<xsl:number value="$bmtemp" format="0000"/>
						</xsl:variable>
						<xsl:value-of select="concat('bm', $bm)"/>
					</xsl:when>
					<xsl:otherwise>
						<xsl:value-of select="@class"/>
					</xsl:otherwise>
				</xsl:choose>
				<xsl:value-of select="'.xlink.html'"/>
			</xsl:variable>
			<xsl:result-document href="{$filename}" format="html">
				<html>
					<xsl:copy-of select="$htmlhead"/>
					<body>
						<div>
							<xsl:apply-templates/>
						</div>
					</body>
				</html>
			</xsl:result-document>
		</xsl:for-each>
-->
	</xsl:template>
	<!-- HTML Generation End -->

	<!-- XML to HTML Code Generation Start -->
	<xsl:template match="SAGE-hubxml//*">
		<xsl:for-each select=".">
			<xsl:choose>
				<xsl:when test="name(self::*) = 'body' and parent::SAGE-hubxml">
					<xsl:apply-templates/>
				</xsl:when>
				<xsl:when test="name(self::*) = 'div' and @class = 'frontmatter' and parent::body/parent::SAGE-hubxml">
					<xsl:apply-templates/>
				</xsl:when>
				<xsl:when test="name(self::*) = 'div' and @class = 'text' and parent::body/parent::SAGE-hubxml">
					<xsl:apply-templates/>
				</xsl:when>
				<!--				<xsl:when test="name(self::*) = 'div' and @class = 'part' and parent::div/parent::body/parent::SAGE-hubxml">
					<xsl:apply-templates/>
				</xsl:when>-->
				<xsl:when test="name(self::*) = 'div' and @class = 'backmatter' and parent::body/parent::SAGE-hubxml">
					<xsl:apply-templates/>
				</xsl:when>

				<xsl:when test="name(self::*) = 'div' and parent::div[@class = 'metadata']/parent::body ">
					<p class="RPSHEAD">
						<span class="RPSHEAD">
							<xsl:value-of select="@class"/>
						</span>
					</p>
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<!--						<xsl:call-template name="XMLTAG-PARA"/>-->
						<xsl:apply-templates/>
					</xsl:copy>
				</xsl:when>
				<xsl:when test="name(self::*) = 'div' and parent::div/parent::div[@class = 'metadata']/parent::body ">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<span class="label">
							<xsl:text disable-output-escaping="yes">&lt;div</xsl:text>
							<xsl:for-each select="@*">
								<xsl:text> </xsl:text>
								<xsl:value-of select="name(.)"/>
								<xsl:text>='</xsl:text>
								<xsl:value-of select="."/>
								<xsl:text>'</xsl:text>
							</xsl:for-each>
							<xsl:text disable-output-escaping="yes">&gt;</xsl:text>
						</span>
						<xsl:apply-templates/>
						<span class="endlabel">
							<xsl:text disable-output-escaping="yes">&lt;/div&gt;</xsl:text>
						</span>
					</xsl:copy>
				</xsl:when>
				<xsl:when test="name(self::*) = 'div' and parent::div[@class = 'copyright-page']">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<span class="label">
							<xsl:text disable-output-escaping="yes">&lt;div</xsl:text>
							<xsl:for-each select="@*">
								<xsl:text> </xsl:text>
								<xsl:value-of select="name(.)"/>
								<xsl:text>='</xsl:text>
								<xsl:value-of select="."/>
								<xsl:text>'</xsl:text>
							</xsl:for-each>
							<xsl:text disable-output-escaping="yes">&gt;</xsl:text>
						</span>
						<xsl:apply-templates/>
						<span class="endlabel">
							<xsl:text disable-output-escaping="yes">&lt;/div&gt;</xsl:text>
						</span>
					</xsl:copy>
				</xsl:when>

				<xsl:when test="name(self::*) = 'div' and @class = 'metadata' and parent::body">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<!--						<xsl:call-template name="XMLTAG-PARA"/>-->
						<xsl:apply-templates/>
					</xsl:copy>
					<div class="rpsborder"/>
				</xsl:when>
				<xsl:when test="name(self::*) = 'div' and (parent::div[@class = 'frontmatter']/parent::body or parent::div[@class = 'backmatter']/parent::body or parent::div[@class = 'text']/parent::body or parent::div[@class = 'part']/parent::div[@class = 'text']/parent::body)">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<!--						<xsl:call-template name="XMLTAG-PARA"/>-->
						<xsl:apply-templates/>
					</xsl:copy>
					<xsl:choose>
						<xsl:when test="@class = 'metadata' and parent::div[@class = 'part']/parent::div[@class = 'text']/parent::body"> </xsl:when>
						<xsl:otherwise>
							<div class="rpsborder"/>
						</xsl:otherwise>
					</xsl:choose>
				</xsl:when>

				<xsl:when test="name(self::*) = 'div' and (@class = 'image' or @class = 'imprint')">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<span class="label">
							<xsl:text disable-output-escaping="yes">&lt;div</xsl:text>
							<xsl:for-each select="@*">
								<xsl:text> </xsl:text>
								<xsl:value-of select="name(.)"/>
								<xsl:text>='</xsl:text>
								<xsl:value-of select="."/>
								<xsl:text>'</xsl:text>
							</xsl:for-each>
							<xsl:text disable-output-escaping="yes">&gt;</xsl:text>
						</span>
						<xsl:apply-templates/>
						<span class="endlabel">
							<xsl:text disable-output-escaping="yes">&lt;/div&gt;</xsl:text>
						</span>
					</xsl:copy>
				</xsl:when>


				<xsl:when test="name(self::*) = 'p' and @class">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<xsl:choose>
							<xsl:when test="@class = 'citation'">
								<span style="width:200px;">
									<code>
										<xsl:value-of select="span/@class"/>
									</code>
								</span>
							</xsl:when>
							<xsl:otherwise>
								<code>
									<xsl:value-of select="@class"/>
								</code>
							</xsl:otherwise>
						</xsl:choose>
						<xsl:text>&#x00A0;&#x00A0;&#x00A0;</xsl:text>
						<!--						<xsl:call-template name="XMLTAG-PARA"/>-->
						<xsl:apply-templates/>
					</xsl:copy>
				</xsl:when>

				<xsl:when test="name(self::*) = 'div' and (@class = 'sect1' or @class = 'sect2' or @class = 'sect3' or @class = 'sect4' or @class = 'sect5')">
					<xsl:call-template name="XMLTAG-PARA"/>
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<xsl:apply-templates/>
					</xsl:copy>
				</xsl:when>

		

				<xsl:when test="name(self::*) = 'h1'">
					<xsl:if test="span[@class = 'label'] and parent::div[@class = 'chapter']">
						<p class="chnum">
							<xsl:value-of select="span[@class = 'label']"/>
						</p>
					</xsl:if>
					<p>
						<xsl:attribute name="class">
							<xsl:choose>
								
								<xsl:when test="parent::div/parent::div[@class = 'frontmatter']">fmtitle</xsl:when>
								<xsl:when test="parent::div[@class = 'chapter']">chtitle</xsl:when>
								<xsl:when test="parent::div/parent::div[@class = 'backmatter']">bmtitle</xsl:when>
								<xsl:when test="parent::div[@class = 'sect1']">h1</xsl:when>
								<xsl:when test="parent::div[@class = 'learning-objectives']">obj-head</xsl:when>
								<xsl:when test="parent::div[@class = 'boxed-text']">box-head</xsl:when>
								<xsl:when test="parent::div[@class = 'assessment']">ass-head</xsl:when>
								<xsl:when test="parent::div[@class = 'keywords']">key-head</xsl:when>
								<xsl:when test="parent::div[@class = 'exercise']">exe-head</xsl:when>
								<xsl:when test="parent::div[@class = 'case-study']">case-head</xsl:when>
								<xsl:when test="parent::div[@class = 'sidebar']">side-head</xsl:when>
								<xsl:when test="parent::div[@class = 'footnote']">foot-note</xsl:when>
								<xsl:otherwise>h1</xsl:otherwise>
							</xsl:choose>
						</xsl:attribute>
						<xsl:apply-templates/>
					</p>
					<xsl:if test="parent::div[@class = 'chapter']">
						<!--						<xsl:copy-of select="parent::div[@class = 'chapter']/div[@class = 'metadata']/div[@class = 'toc-brief']|parent::div[@class = 'chapter']/div[@class = 'metadata']/div[@class = 'toc']"/>-->
						<xsl:apply-templates select="parent::div[@class = 'chapter']/div[@class = 'metadata']/div[@class = 'toc-brief']|parent::div[@class = 'chapter']/div[@class = 'metadata']/div[@class = 'toc']"/>
					</xsl:if>
				</xsl:when>
				<xsl:when test="name(self::*) = 'h2'">
					<h2>
						<xsl:attribute name="class">
							<xsl:choose>
								<xsl:when test="parent::div[@class = 'sect2']">h2</xsl:when>
								<xsl:otherwise>h2</xsl:otherwise>
							</xsl:choose>
						</xsl:attribute>
						<xsl:apply-templates/>
					</h2>
				</xsl:when>

				<xsl:when test="name(self::*) = 'h3'">
					<h3>
						<xsl:attribute name="class">
							<xsl:choose>
								<xsl:when test="parent::div[@class = 'sect3']">h3</xsl:when>
								<xsl:otherwise>h3</xsl:otherwise>
							</xsl:choose>
						</xsl:attribute>
						<xsl:apply-templates/>
					</h3>
				</xsl:when>
				<xsl:when test="name(self::*) = 'h4'">
					<h4>
						<xsl:attribute name="class">
							<xsl:choose>
								<xsl:when test="parent::div[@class = 'sect4']">h4</xsl:when>
								<xsl:otherwise>h4</xsl:otherwise>
							</xsl:choose>
						</xsl:attribute>
						<xsl:apply-templates/>
					</h4>
				</xsl:when>
	
				<!--				<xsl:when test="name(self::*) = 'dt'"/>-->
				<xsl:when test="name(self::*) = 'head' and parent::SAGE-hubxml"/>

				<!--				<xsl:when test="name(self::*) = 'dd'">
					<p>
						<xsl:attribute name="class">
							<xsl:choose>
								<xsl:when test="preceding-sibling::dd">noindent</xsl:when>
								<xsl:otherwise>noindent</xsl:otherwise>
							</xsl:choose>
						</xsl:attribute>
						<xsl:if test="preceding-sibling::*[1][@class = 'contributor-name']">
							<xsl:apply-templates select="preceding-sibling::*[1][@class = 'contributor-name']" mode="dt"/>
						</xsl:if>
						<xsl:apply-templates/>
					</p>
				</xsl:when>
-->
				<xsl:when test="name(self::*) = 'subscript'">
					<sub>
						<xsl:apply-templates/>
					</sub>
				</xsl:when>
				<xsl:when test="name(self::*) = 'superscript'">
					<sup>
						<xsl:apply-templates/>
					</sup>
				</xsl:when>
<!--new updations done on 26-mar-18-->
					<xsl:when test="parent::entry">
                            <xsl:if test="preceding-sibling::p">
                                <br/>
                            </xsl:if>
                            <xsl:apply-templates/>
                        </xsl:when>
                <xsl:when test="name(self::*) = 'div' and @class = 'speech'">
                    <table class="speech">
                        <tr>
                          <td width="1000px" valign="top" style="background-color : #FFFFCC;color:#990033;">
                                <xsl:apply-templates/>
                            </td>
			                      </tr>
                    </table>
                </xsl:when>
				<xsl:when test="name(self::*) = 'a' and @class = 'page'">
				<span class="page" id="{@id}">
				<span style="padding-left:.2em;padding-right:.2em;background-color:#ebcafe;">
				<xsl:value-of select="concat(' Page ', substring-after(@id, 'pbr-'), ' ')"/>
				</span>
				</span>
				</xsl:when>
				
				<xsl:when test="name(self::*) = 'div' and @class = 'sidebar'">
				<div class="sidebar">
				<xsl:call-template name="XMLTAG-PARA"/>
				<xsl:apply-templates/>
				</div>
				</xsl:when>
				
				<xsl:when test="name(self::*) = 'div' and @class = 'learning-objectives'">
				<div class="learning-objectives">
				<xsl:call-template name="XMLTAG-PARA"/>
				<xsl:apply-templates/>
				</div>
				</xsl:when>
				
				<xsl:when test="name(self::*) = 'div' and @class = 'longdesc'">
				<div class="longdesc">
				<code><xsl:text>longDescription</xsl:text></code>
				<xsl:apply-templates/>
				</div>
				</xsl:when>
				
				
				
<!-- new updation ended-->


				<!--<xsl:when test="name(self::*) = 'a' and @class = 'page-ref'">
					<xsl:choose>
						<xsl:when test="ancestor::ul[@class = 'toc']"/>
						<xsl:otherwise>
							<xsl:copy>
								<xsl:copy-of select="@* except @href except @class"/>
								<xsl:attribute name="class" select="'epubpage-ref'"/>
								<xsl:variable name="href" select="substring-after(@href, '#')"/>
								<xsl:attribute name="href">
									<xsl:call-template name="htmlfilename">
										<xsl:with-param name="xmlid" select="$href"/>
									</xsl:call-template>
									<xsl:value-of select="'.xlink.html'"/>
									<xsl:value-of select="concat('#page_', substring-after(@href, 'pbr-'))"/>
								</xsl:attribute>
								<xsl:apply-templates/>
							</xsl:copy>
						</xsl:otherwise>
					</xsl:choose>
				</xsl:when>
				<xsl:when test="name(self::*) = 'a' and @class = 'chap-ref'">
					<xsl:copy>
						<xsl:copy-of select="@* except @href"/>
						<xsl:attribute name="href">
							<xsl:variable name="href" select="substring-after(@href, '#')"/>
							<xsl:call-template name="htmlfilename">
								<xsl:with-param name="xmlid" select="$href"/>
							</xsl:call-template>
							<!-\-							<xsl:value-of select="'ch'"/>
							<xsl:choose>
								<xsl:when test="contains(., ' ')">
									<xsl:number value="number(substring-after(., ' '))" format="0000"/>
								</xsl:when>
								<xsl:otherwise>
									<xsl:number value="number(.)" format="0000"/>
								</xsl:otherwise>
							</xsl:choose>-\->
							<xsl:value-of select="'.xlink.html'"/>
						</xsl:attribute>
						<xsl:apply-templates/>
					</xsl:copy>
				</xsl:when>
				<xsl:when test="name(self::*) = 'a' and @class = 'section-ref'">
					<xsl:copy>
						<xsl:copy-of select="@* except @href"/>
						<xsl:attribute name="href">
							<xsl:variable name="href" select="substring-after(@href, '#')"/>
							<xsl:call-template name="htmlfilename">
								<xsl:with-param name="xmlid" select="$href"/>
							</xsl:call-template>
							<xsl:value-of select="'.xlink.html'"/>
							<xsl:value-of select="@href"/>
						</xsl:attribute>
						<xsl:apply-templates/>
					</xsl:copy>
				</xsl:when>

				<xsl:when test="name(self::*) = 'a' and @class = 'ref-chap'">
					<xsl:copy>
						<xsl:copy-of select="@* except @href"/>
						<xsl:attribute name="href">
							<xsl:variable name="href" select="substring-after(@href, '#')"/>
							<xsl:call-template name="htmlfilename">
								<xsl:with-param name="xmlid" select="$href"/>
							</xsl:call-template>
							<xsl:value-of select="'.xlink.html'"/>
							<xsl:choose>
								<xsl:when test="//div[@class = 'part'][@id = $href]|//div[@class = 'chapter'][@id = $href]|//div[@id = $href]/parent::div[@class = 'frontmatter']|//div[@id = $href]/parent::div[@class = 'backmatter']"/>
								<xsl:otherwise>
									<xsl:value-of select="@href"/>
								</xsl:otherwise>
							</xsl:choose>
						</xsl:attribute>
						<xsl:apply-templates/>
					</xsl:copy>
				</xsl:when>
				<xsl:when test="name(self::*) = 'a' and not(@class = 'ref-URL') and @href">
					<xsl:copy>
						<xsl:copy-of select="@* except @href"/>
						<xsl:attribute name="href">
							<xsl:variable name="href" select="substring-after(@href, '#')"/>
							<xsl:call-template name="htmlfilename">
								<xsl:with-param name="xmlid" select="$href"/>
							</xsl:call-template>
							<xsl:value-of select="'.xlink.html'"/>
							<xsl:choose>
								<xsl:when test="//div[@class = 'part'][@id = $href]|//div[@class = 'chapter'][@id = $href]|//div[@id = $href]/parent::div[@class = 'frontmatter']|//div[@id = $href]/parent::div[@class = 'backmatter']"/>
								<xsl:otherwise>
									<xsl:value-of select="@href"/>
								</xsl:otherwise>
							</xsl:choose>
						</xsl:attribute>
						<xsl:apply-templates/>
					</xsl:copy>
				</xsl:when>

-->
				<!--				<xsl:when test="name(self::*) = 'blockquote'">
					<div>
						<xsl:attribute name="class">
							<xsl:choose>
								<xsl:when test="name(preceding-sibling::*[1]) = 'h1'">quote</xsl:when>
								<xsl:otherwise>extract</xsl:otherwise>
							</xsl:choose>
						</xsl:attribute>
						<xsl:apply-templates/>
					</div>
				</xsl:when>-->

				<xsl:when test="name(self::*) = 'img'">
					<xsl:choose>					
						<xsl:when test="parent::div[@class = 'table'] or parent::div[@class = 'image'] or parent::div[@class = 'figure']">
							<p class="image">
								<xsl:copy>
									<!--xsl:copy-of select="@*"/-->
									<xsl:attribute name="src">
										<xsl:text>images/</xsl:text>
										<xsl:value-of select="@src"/>
									</xsl:attribute>
								</xsl:copy>
							</p>							
							
						</xsl:when>						
						<xsl:otherwise>
							<xsl:copy>
								<xsl:copy-of select="@*"/>
								<xsl:attribute name="src">
									<xsl:text>images/</xsl:text>
									<xsl:value-of select="@src"/>
								</xsl:attribute>
							</xsl:copy>
						</xsl:otherwise>
						</xsl:choose>
						
						<xsl:choose>
						
						<xsl:when test="@alt">
						<div class="codex">						
							<code><xsl:text>altText:</xsl:text></code><xsl:text> </xsl:text>
							<xsl:value-of select="@alt"/>						
						</div>
						</xsl:when>
						
						
						
						</xsl:choose>
						
				</xsl:when>
				
				
				<xsl:when test="name(self::*) = 'div' and @class = 'figure'">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<span class="label">
							<xsl:text disable-output-escaping="yes">&lt;div</xsl:text>
							<xsl:for-each select="@*">
								<xsl:text> </xsl:text>
								<xsl:value-of select="name(.)"/>
								<xsl:text>='</xsl:text>
								<xsl:value-of select="."/>
								<xsl:text>'</xsl:text>
							</xsl:for-each>
							<xsl:text disable-output-escaping="yes">&gt;</xsl:text>
						</span>

						<xsl:for-each select="img">
							<p class="image">
								<xsl:copy>
									<!--xsl:copy-of select="@*"/-->
									<xsl:attribute name="src">
										<xsl:text>images/</xsl:text>
										<xsl:value-of select="@src"/>
									</xsl:attribute>
								</xsl:copy>								
							</p>							
						</xsl:for-each>
						<div class="codex">
								<xsl:copy>									
										<code><xsl:text>altText:</xsl:text></code>
										<xsl:text> </xsl:text>
										<xsl:value-of select="img/@alt"/>									
								</xsl:copy>								
						</div>								
						<xsl:apply-templates select="div|p"/>
						<span class="endlabel">
							<xsl:text disable-output-escaping="yes">&lt;/div&gt;</xsl:text>
						</span>
					</xsl:copy>
				</xsl:when>

				<xsl:when test="name(self::*) = 'p' and parent::div[@class = 'figure']">
					<p>
						<xsl:copy-of select="@*"/>
						<xsl:attribute name="class" select="'figurecaption'"/>
						<xsl:apply-templates/>
					</p>
				</xsl:when>
				
				
				
				<xsl:when test="name(self::*) = 'span' and @class = 'label' and parent::h1/parent::div[@class = 'chapter']"/>
				<xsl:when test="name(self::*) = 'dl'">
					<xsl:apply-templates/>
				</xsl:when>
				<xsl:when test="name(self::*) = 'ol'">
					<xsl:apply-templates/>
				</xsl:when>
				<!--				<xsl:when test="name(self::*) = 'ul'">
					<xsl:apply-templates/>
				</xsl:when>-->
				<xsl:when test="name(self::*) = 'span' and @class = 'list-label'">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<xsl:apply-templates/>
					</xsl:copy>
					<xsl:choose>
						<xsl:when test="parent::li/parent::*[@class = 'custom']">
							<xsl:text>&#x00A0;&#x00A0;&#x00A0;</xsl:text>
						</xsl:when>
					</xsl:choose>
				</xsl:when>
				<xsl:when test="name(self::*) = 'table'">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<xsl:apply-templates/>
					</xsl:copy>
				</xsl:when>
				<xsl:when test="name(self::*) = 'tgroup'">
					<xsl:apply-templates/>
				</xsl:when>
				<xsl:when test="name(self::*) = 'colspec'">
					<xsl:apply-templates/>
				</xsl:when>
				<xsl:when test="name(self::*) = 'thead'">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<xsl:apply-templates/>
					</xsl:copy>
				</xsl:when>
				<xsl:when test="name(self::*) = 'row'">
					<tr>
						<xsl:copy-of select="@*"/>
						<xsl:apply-templates/>
					</tr>
				</xsl:when>
				<xsl:when test="name(self::*) = 'entry'">
					<td>
						<xsl:choose>
							<xsl:when test="ancestor::thead">
								<xsl:attribute name="style">
									<xsl:value-of select="'background-color:#94BFD4'"/>
								</xsl:attribute>
							</xsl:when>
							<xsl:otherwise>
								<xsl:attribute name="style">
									<xsl:value-of select="'background-color:#CCCCFF'"/>
								</xsl:attribute>
							</xsl:otherwise>
						</xsl:choose>
						<xsl:call-template name="COLSPAN"/>
						<xsl:copy-of select="@*"/>
						<xsl:apply-templates/>
					</td>
				</xsl:when>

				<xsl:when test="name(self::*) = 'li'">
					<p>
						<xsl:choose>
							<xsl:when test="@class">
								<xsl:copy-of select="@*"/>
							</xsl:when>
							<xsl:otherwise>
								<xsl:attribute name="class">
									<xsl:choose>
										<xsl:when test="parent::*[@class = 'index']">
											<xsl:choose>
												<xsl:when test="count(ancestor::ul[@class = 'index']) = 1">index</xsl:when>
												<xsl:when test="count(ancestor::ul[@class = 'index']) = 2">index1</xsl:when>
												<xsl:when test="count(ancestor::ul[@class = 'index']) = 3">index2</xsl:when>
												<xsl:when test="count(ancestor::ul[@class = 'index']) = 4">index3</xsl:when>
												<xsl:otherwise>index</xsl:otherwise>
											</xsl:choose>
										</xsl:when>
										<xsl:when test="parent::*[@class = 'arabic']">nlist</xsl:when>
										<xsl:when test="parent::*[@class = 'alpha-lower']">llist</xsl:when>
										<xsl:when test="parent::*[@class = 'alpha-upper']">llist</xsl:when>
										<xsl:when test="parent::*[@class = 'roman-lower']">nlist</xsl:when>
										<xsl:when test="parent::*[@class = 'roman-upper']">nlist</xsl:when>
										<xsl:when test="parent::*[@class = 'disc']">bull</xsl:when>
										<xsl:when test="parent::*[@class = 'circle']">bull</xsl:when>
										<xsl:when test="parent::*[@class = 'square']">bull</xsl:when>
										<xsl:when test="parent::*[@class = 'no-marker']">ulist</xsl:when>
										<xsl:when test="parent::*[@class = 'custom']">clist</xsl:when>
										<xsl:otherwise>list</xsl:otherwise>
									</xsl:choose>

									<xsl:variable name="listcount" select="count(ancestor::ul) + count(ancestor::ol)"/>
									<xsl:if test="not(parent::*[@class = 'index'])">
										<xsl:choose>
											<xsl:when test="$listcount = 1"/>
											<xsl:when test="$listcount = 2">
												<xsl:value-of select="'1'"/>
											</xsl:when>
											<xsl:when test="$listcount = 3">
												<xsl:value-of select="'2'"/>
											</xsl:when>
											<xsl:when test="$listcount = 4">
												<xsl:value-of select="'3'"/>
											</xsl:when>
										</xsl:choose>
									</xsl:if>
								</xsl:attribute>
							</xsl:otherwise>
						</xsl:choose>

						<xsl:choose>
							<xsl:when test="parent::*[@class = 'arabic']">
								<xsl:choose>
									<xsl:when test="count(parent::*/li) &gt; 9 and count(preceding-sibling::li) &lt; 10">&#x00A0;&#x00A0;</xsl:when>
								</xsl:choose>
								<span class="listnum">
									<xsl:number/>
									<xsl:text>.</xsl:text>
								</span>
								<xsl:text>&#x00A0;&#x00A0;&#x00A0;</xsl:text>
							</xsl:when>
							<xsl:when test="parent::*[@class = 'alpha-lower']">
								<span class="listnum">
									<xsl:number format="a"/>
									<xsl:text>.</xsl:text>
								</span>
								<xsl:text>&#x00A0;&#x00A0;&#x00A0;&#x00A0;</xsl:text>
							</xsl:when>
							<xsl:when test="parent::*[@class = 'alpha-upper']">
								<span class="listnum">
									<xsl:number format="A"/>
									
									<xsl:text>.</xsl:text>
								</span>
								<xsl:text>&#x00A0;&#x00A0;&#x00A0;&#x00A0;</xsl:text>
							</xsl:when>
							<xsl:when test="parent::*[@class = 'roman-lower']">
								<span class="listnum">
									<xsl:number format="i"/>
									
									<xsl:text>.</xsl:text>
								</span>
								<xsl:text>&#x00A0;&#x00A0;&#x00A0;&#x00A0;</xsl:text>
							</xsl:when>
							<xsl:when test="parent::*[@class = 'roman-upper']">
								<span class="listnum">
									<xsl:number format="I"/>
									
									<xsl:text>.</xsl:text>
								</span>
								<xsl:text>&#x00A0;&#x00A0;&#x00A0;&#x00A0;</xsl:text>
							</xsl:when>
							<xsl:when test="parent::*[@class = 'disc']">
								<span class="listnum">&#x2022;</span>
								<xsl:text>&#x00A0;&#x00A0;&#x00A0;&#x00A0;</xsl:text>
							</xsl:when>
							<xsl:when test="parent::*[@class = 'circle']">
								<span class="listnum">&#x25E6;</span>
								<xsl:text>&#x00A0;&#x00A0;&#x00A0;&#x00A0;</xsl:text>
							</xsl:when>
							<xsl:when test="parent::*[@class = 'square']">
								<span class="listnum">&#x220E;</span>
								<xsl:text>&#x00A0;&#x00A0;&#x00A0;&#x00A0;</xsl:text>
							</xsl:when>
						</xsl:choose>
						<xsl:apply-templates/>
					</p>
				</xsl:when>

				<xsl:when test="name(self::*) = 'ul'">
					<xsl:copy>
						<xsl:copy-of select="@*"/>
						<xsl:if test="@class = 'toc' or @class = 'book-section' or @class = 'chapter-section'">
							<xsl:attribute name="style" select="'list-style:none;'"/>
						</xsl:if>
						<xsl:apply-templates/>
					</xsl:copy>
				</xsl:when>

				<xsl:when test="name(self::*) = 'p' and parent::entry and not(@class)">
					<xsl:apply-templates/>
				</xsl:when>
				<xsl:when test="name(self::*) = 'p'">
					<p>
						<xsl:copy-of select="@*"/>
						<xsl:choose>
							<xsl:when test="@class">
								<xsl:copy-of select="@class"/>
							</xsl:when>
							<xsl:otherwise>
								<xsl:attribute name="class">
									<xsl:choose>
										<xsl:when test="ancestor::blockquote and name(preceding-sibling::*[1]) = 'h1'">quote</xsl:when>
										<xsl:when test="ancestor::blockquote">extract</xsl:when>
										<!--				rps						<xsl:when test="contains(lower-case(preceding-sibling::h1[1]), 'further reading')">citation</xsl:when>
										<xsl:when test="contains(lower-case(preceding-sibling::h1[1]), 'references to more information')">citation</xsl:when>-->
										<xsl:when test="(name(preceding-sibling::*[1]) = 'p' or (name(preceding-sibling::*[1]) = 'div')) and not(parent::div[@class = 'acknowledgements'])">indent</xsl:when>
										<xsl:otherwise>noindent</xsl:otherwise>
									</xsl:choose>
								</xsl:attribute>
							</xsl:otherwise>
						</xsl:choose>
						<xsl:apply-templates/>
					</p>
				</xsl:when>

				<xsl:otherwise>
					<xsl:element name="{name(.)}">
						<xsl:copy-of select="@*"/>
						<xsl:apply-templates/>
					</xsl:element>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:for-each>
	</xsl:template>

	<xsl:template name="COLSPAN">
		<xsl:if test="@namest">
			<xsl:attribute name="colspan">
				<xsl:value-of select="number(substring-after(@nameend, '')) - number(substring-after(@namest, '')) + 1"/>
			</xsl:attribute>
		</xsl:if>
		<xsl:if test="@morerows">
			<xsl:attribute name="rowspan">
				<xsl:value-of select="@morerows + 1"/>
			</xsl:attribute>
		</xsl:if>
		<xsl:if test="@align">
			<xsl:attribute name="align">
				<xsl:value-of select="@align"/>
			</xsl:attribute>
		</xsl:if>
		<xsl:if test="@valign">
			<xsl:attribute name="valign">
				<xsl:value-of select="@valign"/>
			</xsl:attribute>
		</xsl:if>
		<xsl:if test="@rowsep">
			<xsl:attribute name="class">
				<xsl:value-of select="@rowsep"/>
			</xsl:attribute>
		</xsl:if>
	</xsl:template>

	<xsl:template match="dt" mode="dt">
		<xsl:apply-templates/>
	</xsl:template>

	<xsl:template name="htmlfilename">
		<xsl:param name="xmlid"/>

		<xsl:choose>
			<xsl:when test="//div[@class = 'part'][@id = $xmlid]">
				<xsl:value-of select="'part'"/>
				<xsl:number value="count(//div[@class = 'part'][@id = $xmlid]/preceding::div[@class = 'part']) + 1" format="0000"/>
			</xsl:when>
			<xsl:when test="//*[@id = $xmlid]/ancestor-or-self::div[@class = 'part'] and not(//*[@id = $xmlid]/ancestor-or-self::div[@class = 'chapter'])">
				<xsl:value-of select="'partRPS'"/>
				<xsl:number value="count(//*[@id = $xmlid]/ancestor-or-self::div[@class = 'part']/preceding::div[@class = 'part']) + 1" format="0000"/>
			</xsl:when>
			<xsl:when test="//div[@class = 'chapter'][@id = $xmlid]">
				<xsl:value-of select="'ch'"/>
				<xsl:choose>
					<xsl:when test="contains(lower-case(//div[@class = 'text']/div[@class = 'chapter'][1]/h1/span[@class = 'label']), 'introduction') or (not(//div[@class = 'text']/div[@class = 'chapter'][1]/h1/span[@class = 'label']) and contains(lower-case(//div[@class = 'text']/div[@class = 'chapter'][1]/h1), 'introduction'))">
						<xsl:number value="count(//div[@class = 'chapter'][@id = $xmlid]/preceding::div[@class = 'chapter'])" format="0000"/>
					</xsl:when>
					<xsl:otherwise>
						<xsl:number value="count(//div[@class = 'chapter'][@id = $xmlid]/preceding::div[@class = 'chapter']) + 1" format="0000"/>
					</xsl:otherwise>
				</xsl:choose>
			</xsl:when>
			<xsl:when test="//*[@id = $xmlid]/ancestor-or-self::div[@class = 'chapter']">
				<xsl:value-of select="'ch'"/>
				<xsl:choose>
					<xsl:when test="contains(lower-case(//div[@class = 'text']/div[@class = 'chapter'][1]/h1/span[@class = 'label']), 'introduction') or (not(//div[@class = 'text']/div[@class = 'chapter'][1]/h1/span[@class = 'label']) and contains(lower-case(//div[@class = 'text']/div[@class = 'chapter'][1]/h1), 'introduction'))">
						<xsl:number value="count(//*[@id = $xmlid]/ancestor-or-self::div[@class = 'chapter']/preceding::div[@class = 'chapter'])" format="0000"/>
					</xsl:when>
					<xsl:otherwise>
						<xsl:number value="count(//*[@id = $xmlid]/ancestor-or-self::div[@class = 'chapter']/preceding::div[@class = 'chapter']) + 1" format="0000"/>
					</xsl:otherwise>
				</xsl:choose>
			</xsl:when>
			<xsl:when test="//*[@id = $xmlid]/parent::div[@class = 'frontmatter']">
				<xsl:value-of select="'fm'"/>
				<xsl:number value="count(//*[@id = $xmlid][parent::div[@class = 'frontmatter']]/preceding-sibling::div[not(@class = 'half-title' or @class = 'title-page' or @class = 'copyright-page' or @class = 'toc-brief' or @class = 'toc')]) + 1" format="0000"/>
			</xsl:when>
			<xsl:when test="//*[@id = $xmlid]/ancestor-or-self::div[@class = 'frontmatter']">
				<xsl:value-of select="'fm'"/>
				<xsl:number value="count(//*[@id = $xmlid]/ancestor-or-self::div[parent::div[@class = 'frontmatter']]/preceding-sibling::div[not(@class = 'half-title' or @class = 'title-page' or @class = 'copyright-page' or @class = 'toc-brief' or @class = 'toc')]) + 1" format="0000"/>
			</xsl:when>
			<xsl:when test="//*[@id = $xmlid]/parent::div[@class = 'backmatter']">
				<xsl:variable name="currclass" select="//*[@id = $xmlid][parent::div[@class = 'backmatter']]/@class"/>
				<xsl:choose>
					<xsl:when test="//*[@id = $xmlid][parent::div[@class = 'backmatter']]/preceding-sibling::div[@class = $currclass]">
						<xsl:variable name="bmtemp">
							<xsl:value-of select="count(//*[@id = $xmlid][parent::div[@class = 'backmatter']]/preceding-sibling::div) + 1"/>
						</xsl:variable>
						<xsl:variable name="bm">
							<xsl:number value="$bmtemp" format="0000"/>
						</xsl:variable>
						<xsl:value-of select="concat('bm', $bm)"/>
					</xsl:when>
					<xsl:otherwise>
						<xsl:value-of select="//*[@id = $xmlid][parent::div[@class = 'backmatter']]/@class"/>
					</xsl:otherwise>
				</xsl:choose>
			</xsl:when>
			<xsl:when test="//*[@id = $xmlid]/ancestor-or-self::div[@class = 'backmatter']">
				<xsl:variable name="currclass" select="//*[@id = $xmlid]/ancestor-or-self::div[parent::div[@class = 'backmatter']]/@class"/>
				<xsl:choose>
					<xsl:when test="//*[@id = $xmlid]/ancestor-or-self::div[parent::div[@class = 'backmatter']]/preceding-sibling::div[@class = $currclass]">
						<xsl:variable name="bmtemp">
							<xsl:value-of select="count(//*[@id = $xmlid]/ancestor-or-self::div[parent::div[@class = 'backmatter']]/preceding-sibling::div) + 1"/>
						</xsl:variable>
						<xsl:variable name="bm">
							<xsl:number value="$bmtemp" format="0000"/>
						</xsl:variable>
						<xsl:value-of select="concat('bm', $bm)"/>
					</xsl:when>
					<xsl:otherwise>
						<xsl:value-of select="//*[@id = $xmlid]/ancestor-or-self::div[parent::div[@class = 'backmatter']]/@class"/>
					</xsl:otherwise>
				</xsl:choose>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="'TEMP'"/>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template name="calculate.colspan">
		<xsl:param name="entry" select="."/>
		<xsl:variable name="namest" select="$entry/@namest"/>
		<xsl:variable name="nameend" select="$entry/@nameend"/>

		<xsl:variable name="scol">
			<xsl:call-template name="colspec.colnum">
				<xsl:with-param name="colspec" select="$entry/ancestor::tgroup/colspec[@colname=$namest]"/>
			</xsl:call-template>
		</xsl:variable>
		<xsl:variable name="ecol">
			<xsl:call-template name="colspec.colnum">
				<xsl:with-param name="colspec" select="$entry/ancestor::tgroup/colspec[@colname=$nameend]"/>
			</xsl:call-template>
		</xsl:variable>
		<xsl:value-of select="$ecol - $scol + 1"/>
	</xsl:template>

	<xsl:template name="colspec.colnum">
		<xsl:param name="colspec" select="."/>
		<xsl:choose>
			<xsl:when test="$colspec/@colnum">
				<xsl:value-of select="$colspec/@colnum"/>
			</xsl:when>
			<xsl:when test="$colspec/preceding-sibling::colspec">
				<xsl:value-of select="count($colspec/preceding-sibling::colspec) + 1"/>
			</xsl:when>
			<xsl:otherwise>1</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="a" mode="ncx">
		<xsl:apply-templates mode="ncx"/>
	</xsl:template>

	<xsl:template match="span" mode="ncx">
		<xsl:apply-templates/>
	</xsl:template>

	<xsl:template match="a[@class = 'page-ref']" mode="ncx"/>

	<xsl:template name="XMLTAG-PARA">
		<p class="xmltag-para">
			<span class="tag">
				<xsl:value-of select="name(self::*)"/>
			</span>
			<xsl:for-each select="@*">
				<span class="attr">
					<xsl:text>  </xsl:text>
					<span class="attrname">
						<xsl:value-of select="name(.)"/>
					</span>
					<xsl:text>: </xsl:text>
					<span class="attrvalue">
						<xsl:value-of select="."/>
					</span>
				</span>
			</xsl:for-each>
			<xsl:choose>
				<xsl:when test="name(self::*) = 'table'">
					<br/>
					<br/>
					<xsl:text>Column-count:&#160;&#160;&#160;&#160;&#160;</xsl:text>
					<xsl:value-of select="count(colgroup/col)"/>
				</xsl:when>
			</xsl:choose>
		</p>
	</xsl:template>

	<xsl:template name="XMLTAG-CHARACTER">
		<xsl:text> </xsl:text>
		<span class="xmltag-character">
			<span class="tag">
				<xsl:value-of select="name(self::*)"/>
			</span>
			<xsl:for-each select="@*">
				<span class="attr">
					<xsl:text>  </xsl:text>
					<span class="attrname">
						<xsl:value-of select="name(.)"/>
					</span>
					<xsl:text>: </xsl:text>
					<span class="attrvalue">
						<xsl:value-of select="."/>
					</span>
				</span>
			</xsl:for-each>
			<xsl:text> </xsl:text>
		</span>
	</xsl:template>


</xsl:stylesheet>
